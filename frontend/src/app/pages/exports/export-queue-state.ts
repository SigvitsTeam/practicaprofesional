import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, timeout } from 'rxjs';
import { ExportJobsApiService, ExportJobRecord } from '../../core/export-jobs-api.service';

const REFRESH_INTERVAL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_AUTOMATIC_REFRESHES = 30;
const MAX_CONSECUTIVE_FAILURES = 3;

function newerJob(current: ExportJobRecord, incoming: ExportJobRecord): ExportJobRecord {
  if (current.updatedAt !== incoming.updatedAt)
    return Date.parse(current.updatedAt) > Date.parse(incoming.updatedAt) ? current : incoming;
  const progress = { PENDIENTE: 0, PROCESANDO: 1, FALLIDO: 2, COMPLETADO: 2 };
  return progress[current.status] > progress[incoming.status] ? current : incoming;
}

/** Component-scoped queue: only active jobs are polled, never with overlapping requests. */
@Injectable()
export class ExportQueueState {
  private readonly api = inject(ExportJobsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localJobs = new Map<string, ExportJobRecord>();
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private automaticRefreshes = 0;
  private consecutiveFailures = 0;
  readonly jobs = signal<ExportJobRecord[]>([]);
  readonly refreshing = signal(false);
  readonly error = signal('');
  readonly autoRefreshPaused = signal(false);
  readonly hasPendingJobs = computed(() =>
    this.jobs().some((job) => job.status === 'PENDIENTE' || job.status === 'PROCESANDO'),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  refresh() {
    if (this.refreshing() || this.destroyRef.destroyed) return;
    this.automaticRefreshes = 0;
    this.consecutiveFailures = 0;
    this.autoRefreshPaused.set(false);
    this.clearTimer();
    this.load();
  }

  record(job: ExportJobRecord) {
    if (this.destroyRef.destroyed) return;
    const existing = this.jobs().find((item) => item.id === job.id);
    const latest = existing ? newerJob(existing, job) : job;
    this.localJobs.set(job.id, latest);
    this.jobs.update((jobs) => [latest, ...jobs.filter((item) => item.id !== job.id)]);
    this.automaticRefreshes = 0;
    this.consecutiveFailures = 0;
    this.autoRefreshPaused.set(false);
    this.scheduleRefresh();
  }

  private load() {
    if (this.refreshing() || this.destroyRef.destroyed) return;
    this.refreshing.set(true);
    this.error.set('');
    this.api
      .list()
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.refreshing.set(false);
          this.scheduleRefresh();
        }),
      )
      .subscribe({
        next: (incoming) => {
          const jobs = incoming.map((job) => {
            const local = this.localJobs.get(job.id);
            if (!local) return job;
            const latest = newerJob(local, job);
            if (latest === job) this.localJobs.delete(job.id);
            return latest;
          });
          const incomingIds = new Set(jobs.map((job) => job.id));
          // A GET started before a successful POST may not contain the newly created job yet.
          this.jobs.set([
            ...Array.from(this.localJobs.values()).filter((job) => !incomingIds.has(job.id)),
            ...jobs,
          ]);
          this.consecutiveFailures = 0;
        },
        error: () => {
          this.consecutiveFailures += 1;
          this.error.set('No fue posible actualizar la cola. Los trabajos visibles se conservan.');
        },
      });
  }

  private scheduleRefresh() {
    this.clearTimer();
    if (this.destroyRef.destroyed || this.refreshing() || !this.hasPendingJobs()) return;
    if (
      this.automaticRefreshes >= MAX_AUTOMATIC_REFRESHES ||
      this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
    ) {
      this.autoRefreshPaused.set(true);
      return;
    }
    this.refreshTimer = setTimeout(
      () => {
        this.refreshTimer = undefined;
        this.automaticRefreshes += 1;
        this.load();
      },
      REFRESH_INTERVAL_MS * (this.consecutiveFailures + 1),
    );
  }

  private clearTimer() {
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }
}
