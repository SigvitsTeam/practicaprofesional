import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ExportJobRecord, ExportJobsApiService } from '../../core/export-jobs-api.service';
import {
  ItsCaptureApiService,
  TerritorialAnalyticsResponse,
} from '../../core/its-capture-api.service';
import { OperationalPeriodService } from '../../core/operational-period';
import { RoleContext } from '../../core/role-context';
import { Exports } from './exports';

describe('Exports request lifecycle', () => {
  let fixture: ComponentFixture<Exports>;
  let element: HTMLElement;
  let analytics: Subject<TerritorialAnalyticsResponse>;
  let creation: Subject<ExportJobRecord>;
  const selectedPeriod = signal({ year: 2026, month: 8 });
  let create: ReturnType<typeof vi.fn>;
  let getTerritorialAnalytics: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    selectedPeriod.set({ year: 2026, month: 8 });
    analytics = new Subject<TerritorialAnalyticsResponse>();
    creation = new Subject<ExportJobRecord>();
    create = vi.fn(() => creation);
    getTerritorialAnalytics = vi.fn(() => analytics);
    await TestBed.configureTestingModule({
      imports: [Exports],
      providers: [
        { provide: AuthService, useValue: { isDemo: () => false, user: () => ({ name: 'QA' }) } },
        { provide: RoleContext, useValue: { activeRoleId: () => 'municipal-coordinator' } },
        { provide: OperationalPeriodService, useValue: { selected: selectedPeriod } },
        { provide: ExportJobsApiService, useValue: { list: () => of([]), create } },
        { provide: ItsCaptureApiService, useValue: { getTerritorialAnalytics } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Exports);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function scopedButton() {
    const button = element.querySelector<HTMLButtonElement>('.export-catalog button');
    if (!button) throw new Error('Missing scoped export action');
    return button;
  }

  function resolveTargets() {
    analytics.next({
      rows: [{ id: 'facility-1', code: '001', name: 'Centro autorizado' }],
    } as TerritorialAnalyticsResponse);
    analytics.complete();
    fixture.detectChanges();
  }

  it('shows and submits the captured month even if the global period changes while loading targets', () => {
    scopedButton().click();
    expect(getTerritorialAnalytics).toHaveBeenCalledWith('ESTABLECIMIENTO', 2026, 8);
    selectedPeriod.set({ year: 2026, month: 9 });
    resolveTargets();
    const dialog = element.querySelector<HTMLElement>('.scoped-export-dialog');
    expect(dialog?.textContent).toContain('agosto');
    const generate = dialog?.querySelector<HTMLButtonElement>('footer .primary');
    generate?.click();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        territoryId: 'facility-1',
        year: 2026,
        month: 8,
      }),
    );
    fixture.detectChanges();
    expect(generate?.disabled).toBe(true);
    generate?.click();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('cancels the scoped catalog request when leaving the page', () => {
    scopedButton().click();
    expect(analytics.observed).toBe(true);
    fixture.destroy();
    expect(analytics.observed).toBe(false);
  });

  it('cancels the export response subscription when leaving the page', () => {
    scopedButton().click();
    resolveTargets();
    element.querySelector<HTMLButtonElement>('.scoped-export-dialog footer .primary')?.click();
    expect(creation.observed).toBe(true);
    fixture.destroy();
    expect(creation.observed).toBe(false);
  });
});
