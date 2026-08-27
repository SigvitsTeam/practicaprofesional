import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import { Report } from '../../core/models';
import { ReportDrawer } from './report-drawer';

const report: Report = {
  workflowId: 'report-1',
  workflowLevel: 'facility',
  version: 1,
  name: 'CIS de prueba',
  code: '0001',
  status: 'En revisión',
  total: 6,
  newCases: 4,
  controls: 2,
  alerts: 0,
  sent: '26 ago 2026, 9:00 a. m.',
  periodYear: 2026,
  periodMonth: 8,
};

describe('ReportDrawer', () => {
  const returnIts2Report = vi.fn();
  const approveIts2Report = vi.fn();

  beforeEach(async () => {
    returnIts2Report.mockReset();
    approveIts2Report.mockReset();
    await TestBed.configureTestingModule({
      imports: [ReportDrawer],
      providers: [
        { provide: AuthService, useValue: { isDemo: signal(false) } },
        {
          provide: ItsCaptureApiService,
          useValue: { returnIts2Report, approveIts2Report },
        },
      ],
    }).compileComponents();
  });

  it('keeps the drawer and observation open when the workflow action fails', () => {
    returnIts2Report.mockReturnValue(
      throwError(() => ({ error: { detail: 'El reporte cambió de versión.' } })),
    );
    const fixture = TestBed.createComponent(ReportDrawer);
    fixture.componentRef.setInput('report', report);
    const component = fixture.componentInstance;
    const success = vi.fn();
    component.action.subscribe(success);
    component.observation = 'Corregir la procedencia antes de reenviar.';

    component.returnReport();
    fixture.detectChanges();

    expect(success).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('El reporte cambió de versión.');
    expect(component.observation).toBe('Corregir la procedencia antes de reenviar.');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('emits the action event only after a successful approval', () => {
    approveIts2Report.mockReturnValue(of({}));
    const fixture = TestBed.createComponent(ReportDrawer);
    fixture.componentRef.setInput('report', report);
    const component = fixture.componentInstance;
    const success = vi.fn();
    component.action.subscribe(success);

    component.approveReport();

    expect(success).toHaveBeenCalledWith('Reporte aprobado y registrado en auditoría.');
    expect(component.errorMessage).toBe('');
  });

  it('exposes the detail as a labelled modal dialog', () => {
    const fixture = TestBed.createComponent(ReportDrawer);
    fixture.componentRef.setInput('report', report);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('report-drawer-title');
  });
});
