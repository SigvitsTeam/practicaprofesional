import { Injectable } from '@nestjs/common';

const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const EXPORT_DURATION_BUCKETS = [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300];
const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const WORKER_STATES = ['starting', 'idle', 'processing', 'degraded', 'stopping'] as const;

type WorkerState = (typeof WORKER_STATES)[number];

interface HistogramState {
  count: number;
  sum: number;
  buckets: number[];
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

function labels(values: Readonly<Record<string, string>>): string {
  const entries = Object.entries(values);
  return entries.length === 0
    ? ''
    : `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`;
}

@Injectable()
export class MetricsService {
  private httpInFlight = 0;
  private readonly httpRequests = new Map<string, number>();
  private readonly httpDurations = new Map<string, HistogramState>();
  private readonly exportJobs = new Map<string, number>();
  private readonly exportDurations = new Map<string, HistogramState>();
  private readonly artifactCleanup = new Map<string, number>();
  private artifactCleanupBacklog = 0;
  private artifactCleanupOldestAgeSeconds = 0;
  private artifactCleanupLimitReached = 0;
  private workerState: WorkerState = 'starting';
  private workerLastPollUnixSeconds = 0;

  beginHttpRequest(): void {
    this.httpInFlight += 1;
  }

  endHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    this.httpInFlight = Math.max(0, this.httpInFlight - 1);
    const candidateMethod = method.toUpperCase();
    const normalizedMethod = HTTP_METHODS.has(candidateMethod) ? candidateMethod : 'OTHER';
    const normalizedRoute = route.slice(0, 200);
    const status = String(statusCode);
    const key = JSON.stringify([normalizedMethod, normalizedRoute, status]);
    this.httpRequests.set(key, (this.httpRequests.get(key) ?? 0) + 1);
    this.observeHistogram(
      this.httpDurations,
      JSON.stringify([normalizedMethod, normalizedRoute]),
      durationSeconds,
      HTTP_DURATION_BUCKETS,
    );
  }

  recordExportJob(outcome: 'claimed' | 'completed' | 'failed', format: string): void {
    const key = JSON.stringify([outcome, format.toLowerCase().slice(0, 10)]);
    this.exportJobs.set(key, (this.exportJobs.get(key) ?? 0) + 1);
  }

  recordExportDuration(format: string, durationSeconds: number): void {
    this.observeHistogram(
      this.exportDurations,
      JSON.stringify([format.toLowerCase().slice(0, 10)]),
      durationSeconds,
      EXPORT_DURATION_BUCKETS,
    );
  }

  recordArtifactCleanup(outcome: 'deleted' | 'failed'): void {
    this.artifactCleanup.set(outcome, (this.artifactCleanup.get(outcome) ?? 0) + 1);
  }

  recordArtifactCleanupBacklog(count: number, oldestExpiredAt?: Date): void {
    this.artifactCleanupBacklog = Math.max(0, Math.trunc(count));
    this.artifactCleanupOldestAgeSeconds = oldestExpiredAt
      ? Math.max(0, (Date.now() - oldestExpiredAt.getTime()) / 1_000)
      : 0;
  }

  recordArtifactCleanupLimitReached(): void {
    this.artifactCleanupLimitReached += 1;
  }

  recordWorkerPoll(success: boolean): void {
    if (this.workerState === 'stopping') return;
    if (!success) {
      this.workerState = 'degraded';
      return;
    }
    this.workerState = 'idle';
    this.workerLastPollUnixSeconds = Date.now() / 1_000;
  }

  recordWorkerJobStarted(): void {
    if (this.workerState !== 'stopping') this.workerState = 'processing';
  }

  recordWorkerJobFinished(): void {
    if (this.workerState !== 'stopping') this.workerState = 'idle';
  }

  recordWorkerStopping(): void {
    this.workerState = 'stopping';
  }

  isWorkerReady(maxPollAgeMs: number): boolean {
    if (this.workerState === 'processing') return true;
    if (this.workerState !== 'idle' || this.workerLastPollUnixSeconds === 0) return false;
    return Date.now() / 1_000 - this.workerLastPollUnixSeconds <= maxPollAgeMs / 1_000;
  }

  render(): string {
    const lines: string[] = [
      '# HELP sigvits_http_requests_in_flight Current HTTP requests being processed.',
      '# TYPE sigvits_http_requests_in_flight gauge',
      `sigvits_http_requests_in_flight ${this.httpInFlight}`,
      '# HELP sigvits_http_requests_total Completed HTTP requests.',
      '# TYPE sigvits_http_requests_total counter',
    ];
    for (const [key, value] of [...this.httpRequests.entries()].sort()) {
      const [method, route, statusCode] = JSON.parse(key) as [string, string, string];
      lines.push(
        `sigvits_http_requests_total${labels({ method, route, status_code: statusCode })} ${value}`,
      );
    }
    lines.push(
      '# HELP sigvits_http_request_duration_seconds HTTP request latency.',
      '# TYPE sigvits_http_request_duration_seconds histogram',
    );
    this.renderHistogram(
      lines,
      'sigvits_http_request_duration_seconds',
      this.httpDurations,
      HTTP_DURATION_BUCKETS,
      (key) => {
        const [method, route] = JSON.parse(key) as [string, string];
        return { method, route };
      },
    );
    lines.push(
      '# HELP sigvits_export_jobs_total Export jobs observed by the worker.',
      '# TYPE sigvits_export_jobs_total counter',
    );
    for (const [key, value] of [...this.exportJobs.entries()].sort()) {
      const [outcome, format] = JSON.parse(key) as [string, string];
      lines.push(`sigvits_export_jobs_total${labels({ outcome, format })} ${value}`);
    }
    lines.push(
      '# HELP sigvits_export_job_duration_seconds Export generation latency.',
      '# TYPE sigvits_export_job_duration_seconds histogram',
    );
    this.renderHistogram(
      lines,
      'sigvits_export_job_duration_seconds',
      this.exportDurations,
      EXPORT_DURATION_BUCKETS,
      (key) => {
        const [format] = JSON.parse(key) as [string];
        return { format };
      },
    );
    lines.push(
      '# HELP sigvits_export_artifact_cleanup_total Expired artifact cleanup attempts.',
      '# TYPE sigvits_export_artifact_cleanup_total counter',
    );
    for (const [outcome, value] of [...this.artifactCleanup.entries()].sort())
      lines.push(`sigvits_export_artifact_cleanup_total${labels({ outcome })} ${value}`);
    lines.push(
      '# HELP sigvits_export_artifact_cleanup_backlog Last observed expired artifact backlog.',
      '# TYPE sigvits_export_artifact_cleanup_backlog gauge',
      `sigvits_export_artifact_cleanup_backlog ${this.artifactCleanupBacklog}`,
      '# HELP sigvits_export_artifact_cleanup_oldest_age_seconds Age of the oldest observed expired artifact.',
      '# TYPE sigvits_export_artifact_cleanup_oldest_age_seconds gauge',
      `sigvits_export_artifact_cleanup_oldest_age_seconds ${this.artifactCleanupOldestAgeSeconds}`,
      '# HELP sigvits_export_artifact_cleanup_limit_reached_total Cleanup runs stopped by their safety limit.',
      '# TYPE sigvits_export_artifact_cleanup_limit_reached_total counter',
      `sigvits_export_artifact_cleanup_limit_reached_total ${this.artifactCleanupLimitReached}`,
      '# HELP sigvits_export_worker_ready Whether the worker lifecycle state can accept work.',
      '# TYPE sigvits_export_worker_ready gauge',
      `sigvits_export_worker_ready ${this.workerState === 'idle' || this.workerState === 'processing' ? 1 : 0}`,
      '# HELP sigvits_export_worker_state Current worker lifecycle state.',
      '# TYPE sigvits_export_worker_state gauge',
      ...WORKER_STATES.map(
        (state) =>
          `sigvits_export_worker_state${labels({ state })} ${this.workerState === state ? 1 : 0}`,
      ),
      '# HELP sigvits_export_worker_last_successful_poll_timestamp_seconds Last successful queue poll.',
      '# TYPE sigvits_export_worker_last_successful_poll_timestamp_seconds gauge',
      `sigvits_export_worker_last_successful_poll_timestamp_seconds ${this.workerLastPollUnixSeconds}`,
    );
    return `${lines.join('\n')}\n`;
  }

  private observeHistogram(
    collection: Map<string, HistogramState>,
    key: string,
    value: number,
    buckets: readonly number[],
  ): void {
    const state = collection.get(key) ?? {
      count: 0,
      sum: 0,
      buckets: buckets.map(() => 0),
    };
    state.count += 1;
    state.sum += Math.max(0, value);
    buckets.forEach((upperBound, index) => {
      if (value <= upperBound) state.buckets[index] = (state.buckets[index] ?? 0) + 1;
    });
    collection.set(key, state);
  }

  private renderHistogram(
    lines: string[],
    metric: string,
    collection: ReadonlyMap<string, HistogramState>,
    buckets: readonly number[],
    getLabels: (key: string) => Record<string, string>,
  ): void {
    for (const [key, state] of [...collection.entries()].sort()) {
      const baseLabels = getLabels(key);
      buckets.forEach((upperBound, index) =>
        lines.push(
          `${metric}_bucket${labels({ ...baseLabels, le: String(upperBound) })} ${state.buckets[index] ?? 0}`,
        ),
      );
      lines.push(`${metric}_bucket${labels({ ...baseLabels, le: '+Inf' })} ${state.count}`);
      lines.push(`${metric}_sum${labels(baseLabels)} ${state.sum}`);
      lines.push(`${metric}_count${labels(baseLabels)} ${state.count}`);
    }
  }
}
