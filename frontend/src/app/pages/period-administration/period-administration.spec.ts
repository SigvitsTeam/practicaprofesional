import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  PeriodAdminApiService,
  type ManagedPeriodRecord,
} from '../../core/period-admin-api.service';
import { RoleContext } from '../../core/role-context';
import { OperationalPeriodService } from '../../core/operational-period';
import { PeriodAdministration } from './period-administration';

const period: ManagedPeriodRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  year: 2026,
  month: 9,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  status: 'BLOQUEADO',
  updatedAt: '2026-09-03T12:00:00Z',
  calendarReady: true,
};
describe('PeriodAdministration', () => {
  let fixture: ComponentFixture<PeriodAdministration>;
  let api: {
    list: ReturnType<typeof vi.fn>;
    createCalendar: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    history: ReturnType<typeof vi.fn>;
    openYear: ReturnType<typeof vi.fn>;
  };
  let demoMode: boolean;
  beforeEach(async () => {
    demoMode = false;
    api = {
      list: vi.fn(() => of([period])),
      createCalendar: vi.fn(() => of({ createdMonths: 12, createdWeeks: 53 })),
      open: vi.fn(() => new Subject<ManagedPeriodRecord>()),
      history: vi.fn(() => of([])),
      openYear: vi.fn(() => of({ openedMonths: 12, alreadyOpenMonths: 0, closedMonths: 0 })),
    };
    await TestBed.configureTestingModule({
      imports: [PeriodAdministration],
      providers: [
        { provide: PeriodAdminApiService, useValue: api },
        { provide: AuthService, useValue: { isDemo: () => demoMode } },
        {
          provide: OperationalPeriodService,
          useValue: { fetchCatalog: () => of([]), refreshCatalog: vi.fn() },
        },
      ],
    }).compileComponents();
    TestBed.inject(RoleContext).select('central-validator');
    fixture = TestBed.createComponent(PeriodAdministration);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  it('lists months and opens a visible confirmation after Angular renders', async () => {
    expect(fixture.nativeElement.textContent).toContain('septiembre de 2026');
    (
      fixture.nativeElement.querySelector('button[aria-label^="Abrir"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('.period-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(dialog.querySelector('textarea'));
    expect(api.open).not.toHaveBeenCalled();
  });
  it('requires national confirmation and a detailed reason', () => {
    fixture.componentInstance.open(period);
    fixture.componentInstance.reason = 'Apertura aprobada por nivel central';
    fixture.componentInstance.submit();
    expect(api.open).not.toHaveBeenCalled();
    fixture.componentInstance.confirmed = true;
    fixture.componentInstance.submit();
    expect(api.open).toHaveBeenCalledTimes(1);
    fixture.componentInstance.submit();
    expect(api.open).toHaveBeenCalledTimes(1);
  });
  it('blocks mutations in demo mode', async () => {
    demoMode = true;
    const demo = TestBed.createComponent(PeriodAdministration);
    demo.detectChanges();
    expect(demo.nativeElement.textContent).toContain('modo demostración');
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  it('blocks incomplete calendars and unauthorized roles before sending requests', () => {
    fixture.componentInstance.open({ ...period, calendarReady: false });
    expect(fixture.componentInstance.action()).toBeNull();
    TestBed.inject(RoleContext).select('regional-admin');
    fixture.componentInstance.create();
    fixture.componentInstance.open(period);
    expect(fixture.componentInstance.action()).toBeNull();
    expect(api.open).not.toHaveBeenCalled();
    expect(api.createCalendar).not.toHaveBeenCalled();
  });
  it('keeps the confirmation visible while a mutation is pending', async () => {
    fixture.componentInstance.open(period);
    await fixture.whenStable();
    fixture.componentInstance.reason = 'Apertura aprobada por nivel central';
    fixture.componentInstance.confirmed = true;
    fixture.componentInstance.submit();
    const dialog = fixture.nativeElement.querySelector('.period-dialog') as HTMLDialogElement;
    const escape = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.action()).not.toBeNull();
    expect(dialog.open).toBe(true);
  });
  it('shows a version conflict without announcing success', async () => {
    api.open.mockReturnValue(
      throwError(() => ({ error: { detail: 'El período cambió. Actualice el listado.' } })),
    );
    fixture.componentInstance.open(period);
    fixture.componentInstance.reason = 'Apertura aprobada por nivel central';
    fixture.componentInstance.confirmed = true;
    fixture.componentInstance.submit();
    await fixture.whenStable();
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(fixture.componentInstance.feedback()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('El período cambió. Actualice el listado.');
  });
  it('opens all twelve months with one confirmation and sends their observed versions', async () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      ...period,
      id: `period-${i}`,
      month: i + 1,
    }));
    fixture.componentInstance.periods.set(months);
    fixture.componentInstance.year.set(2026);
    fixture.componentInstance.openYear();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('incluidos meses pasados y futuros');
    fixture.componentInstance.submit();
    expect(api.openYear).not.toHaveBeenCalled();
    fixture.componentInstance.confirmed = true;
    fixture.componentInstance.submit();
    expect(api.openYear).toHaveBeenCalledWith(2026, months, expect.any(String), true);
  });
  it('does not offer annual opening for a partial or incomplete calendar', () => {
    fixture.componentInstance.openYear();
    expect(fixture.componentInstance.action()).toBeNull();
    fixture.componentInstance.periods.set(
      Array.from({ length: 12 }, (_, i) => ({ ...period, month: i + 1, calendarReady: i !== 5 })),
    );
    fixture.componentInstance.openYear();
    expect(fixture.componentInstance.action()).toBeNull();
    expect(api.openYear).not.toHaveBeenCalled();
  });
});
