import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ExportJobRecord, ExportJobsApiService } from '../../core/export-jobs-api.service';
import { ExportQueueState } from './export-queue-state';

function job(status: ExportJobRecord['status'] = 'PENDIENTE'): ExportJobRecord {
  return {
    id: 'job-1',
    reportType: 'ITS2_MONTHLY',
    format: 'XLSX',
    scopeLevel: 'ESTABLECIMIENTO',
    year: 2026,
    month: 8,
    status,
    attempts: 0,
    outputAvailable: status === 'COMPLETADO',
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
  };
}

describe('ExportQueueState', () => {
  let queue: ExportQueueState;
  let list: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    list = vi.fn(() => of<ExportJobRecord[]>([]));
    TestBed.configureTestingModule({
      providers: [ExportQueueState, { provide: ExportJobsApiService, useValue: { list } }],
    });
    queue = TestBed.inject(ExportQueueState);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('refreshes pending jobs through completion and stops polling terminal jobs', () => {
    list
      .mockReturnValueOnce(of([job()]))
      .mockReturnValueOnce(of([job('PROCESANDO')]))
      .mockReturnValueOnce(of([job('COMPLETADO')]));
    queue.refresh();
    vi.advanceTimersByTime(10_000);
    expect(queue.jobs()[0].status).toBe('PROCESANDO');
    vi.advanceTimersByTime(10_000);
    expect(queue.jobs()[0].outputAvailable).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('does not overlap refresh requests, including repeated manual refreshes', () => {
    const pending = new Subject<ExportJobRecord[]>();
    list.mockReturnValue(pending);
    queue.refresh();
    queue.refresh();
    queue.record(job());
    vi.advanceTimersByTime(10_000);
    expect(list).toHaveBeenCalledTimes(1);
    expect(queue.refreshing()).toBe(true);
    pending.next([job()]);
    pending.complete();
    expect(queue.refreshing()).toBe(false);
  });

  it('preserves a newly created job when an older GET omits it', () => {
    const initial = new Subject<ExportJobRecord[]>();
    list.mockReturnValueOnce(initial).mockReturnValueOnce(of([job('COMPLETADO')]));
    queue.refresh();
    queue.record(job());
    initial.next([]);
    initial.complete();
    expect(queue.jobs().map((item) => item.id)).toEqual(['job-1']);
    vi.advanceTimersByTime(10_000);
    expect(queue.jobs()[0].status).toBe('COMPLETADO');
  });

  it('does not regress a completed job when its POST response arrives late', () => {
    list.mockReturnValue(of([job('COMPLETADO')]));
    queue.refresh();
    queue.record(job());
    expect(queue.jobs()[0].status).toBe('COMPLETADO');
    expect(queue.hasPendingJobs()).toBe(false);
  });

  it('bounds automatic requests and lets the user restart observation', () => {
    list.mockReturnValue(of([job()]));
    queue.refresh();
    vi.advanceTimersByTime(600_000);
    expect(list).toHaveBeenCalledTimes(31);
    expect(queue.autoRefreshPaused()).toBe(true);
    queue.refresh();
    expect(list).toHaveBeenCalledTimes(32);
    expect(queue.autoRefreshPaused()).toBe(false);
  });

  it('backs off and pauses after three consecutive failures without discarding jobs', () => {
    list
      .mockReturnValueOnce(of([job()]))
      .mockImplementation(() => throwError(() => new Error('offline')));
    queue.refresh();
    vi.advanceTimersByTime(120_000);
    expect(list).toHaveBeenCalledTimes(4);
    expect(queue.jobs()).toHaveLength(1);
    expect(queue.error()).toContain('No fue posible');
    expect(queue.autoRefreshPaused()).toBe(true);
  });

  it('times out a hanging request and releases the manual refresh control', () => {
    const pending = new Subject<ExportJobRecord[]>();
    list.mockReturnValue(pending);
    queue.refresh();
    vi.advanceTimersByTime(15_000);
    expect(queue.refreshing()).toBe(false);
    expect(queue.error()).toContain('No fue posible');
    expect(pending.observed).toBe(false);
  });

  it('cancels in-flight HTTP and scheduled polling when the component scope is destroyed', () => {
    const pending = new Subject<ExportJobRecord[]>();
    list.mockReturnValueOnce(of([job()])).mockReturnValueOnce(pending);
    queue.refresh();
    vi.advanceTimersByTime(10_000);
    expect(pending.observed).toBe(true);
    TestBed.resetTestingModule();
    expect(pending.observed).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('clears a scheduled refresh on destruction', () => {
    list.mockReturnValue(of([job()]));
    queue.refresh();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(60_000);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
