import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('renders RED metrics with bounded labels and cumulative histograms', () => {
    const metrics = new MetricsService();
    metrics.beginHttpRequest();
    metrics.endHttpRequest('get', '/api/v1/health', 200, 0.02);
    metrics.recordExportJob('claimed', 'XLSX');
    metrics.recordExportJob('completed', 'XLSX');
    metrics.recordExportDuration('XLSX', 0.4);
    metrics.recordWorkerPoll(true);

    const output = metrics.render();

    expect(output).toContain(
      'sigvits_http_requests_total{method="GET",route="/api/v1/health",status_code="200"} 1',
    );
    expect(output).toContain(
      'sigvits_http_request_duration_seconds_bucket{method="GET",route="/api/v1/health",le="0.025"} 1',
    );
    expect(output).toContain('sigvits_export_jobs_total{outcome="completed",format="xlsx"} 1');
    expect(output).toContain('sigvits_export_worker_ready 1');
    expect(output).not.toContain('undefined');
  });

  it('escapes labels before exposing the Prometheus document', () => {
    const metrics = new MetricsService();
    metrics.beginHttpRequest();
    metrics.endHttpRequest('GET', '/quoted"route\\path', 500, 1);

    expect(metrics.render()).toContain('route="/quoted\\"route\\\\path"');
  });

  it('maps non-standard HTTP methods to a bounded OTHER label', () => {
    const metrics = new MetricsService();
    metrics.beginHttpRequest();
    metrics.endHttpRequest('CUSTOM-TENANT-METHOD', '/api/v1/health', 200, 0.01);

    const output = metrics.render();

    expect(output).toContain(
      'sigvits_http_requests_total{method="OTHER",route="/api/v1/health",status_code="200"} 1',
    );
    expect(output).not.toContain('CUSTOM-TENANT-METHOD');
  });

  it('models processing, degraded, and stopping worker states explicitly', () => {
    const metrics = new MetricsService();

    expect(metrics.isWorkerReady(60_000)).toBe(false);
    metrics.recordWorkerPoll(true);
    metrics.recordWorkerJobStarted();
    expect(metrics.isWorkerReady(0)).toBe(true);
    expect(metrics.render()).toContain('sigvits_export_worker_state{state="processing"} 1');

    metrics.recordWorkerJobFinished();
    metrics.recordWorkerPoll(false);
    expect(metrics.isWorkerReady(60_000)).toBe(false);
    expect(metrics.render()).toContain('sigvits_export_worker_state{state="degraded"} 1');

    metrics.recordWorkerStopping();
    metrics.recordWorkerPoll(true);
    expect(metrics.isWorkerReady(60_000)).toBe(false);
    expect(metrics.render()).toContain('sigvits_export_worker_state{state="stopping"} 1');
  });
});
