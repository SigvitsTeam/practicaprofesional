import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  CaptureContextResponse,
  Its2WorkflowReport,
  ItsCaptureApiService,
  ItsMonthlyReportResponse,
} from '../../core/its-capture-api.service';
import { OperationalPeriod, OperationalPeriodService } from '../../core/operational-period';
import { RoleContext } from '../../core/role-context';
import { ReportIts2 } from './report-its2';

interface ReportRequest {
  month: number;
  report: Subject<ItsMonthlyReportResponse>;
  workflow: Subject<Its2WorkflowReport | null>;
}

function period(month: number, status: OperationalPeriod['status'] = 'ABIERTO'): OperationalPeriod {
  return {
    id: `period-${month}`,
    key: `2026-${String(month).padStart(2, '0')}`,
    label: `Mes ${month}`,
    year: 2026,
    month,
    status,
    startDate: `2026-${String(month).padStart(2, '0')}-01`,
    endDate: `2026-${String(month).padStart(2, '0')}-28`,
  };
}

const facility = { id: 'facility-1', code: 'F1', name: 'Centro autorizado' };

function monthly(month: number): ItsMonthlyReportResponse {
  return {
    facility: { ...facility, municipalityName: 'Municipio QA', regionName: 'Región QA' },
    year: 2026,
    month,
    ageGroups: [],
    rows: [],
    totalAttentions: month * 10,
  };
}

function workflow(month: number): Its2WorkflowReport {
  return {
    id: `workflow-${month}`,
    facility,
    municipalityId: 'municipality-1',
    status: 'BORRADOR',
    version: 1,
    year: 2026,
    month,
    totalAttentions: month * 10,
    attentionTotalsComplete: true,
    attentionsUnder15: month,
    attentions15Plus: month * 2,
    attentionTotalsSource: `Estadística mes ${month}`,
    generatedAt: '2026-08-31T12:00:00.000Z',
    openObservations: [],
  };
}

describe('ReportIts2 period and request isolation', () => {
  let fixture: ComponentFixture<ReportIts2>;
  let component: ReportIts2;
  let requests: ReportRequest[];
  let preparation: Subject<Its2WorkflowReport>;
  let pdf: Subject<Blob>;
  let prepareIts2Report: ReturnType<typeof vi.fn>;
  let getMonthlyReport: ReturnType<typeof vi.fn>;
  let getCurrentIts2Report: ReturnType<typeof vi.fn>;
  const selectedPeriod = signal(period(8));

  beforeEach(async () => {
    selectedPeriod.set(period(8));
    requests = [];
    preparation = new Subject<Its2WorkflowReport>();
    pdf = new Subject<Blob>();
    const context = new Subject<CaptureContextResponse>();
    getMonthlyReport = vi.fn((_facilityId: string, _year: number, month: number) => {
      const request = {
        month,
        report: new Subject<ItsMonthlyReportResponse>(),
        workflow: new Subject<Its2WorkflowReport | null>(),
      };
      requests.push(request);
      return request.report;
    });
    getCurrentIts2Report = vi.fn(() => latestRequest().workflow);
    prepareIts2Report = vi.fn(() => preparation);
    await TestBed.configureTestingModule({
      imports: [ReportIts2],
      providers: [
        { provide: AuthService, useValue: { isDemo: () => false } },
        { provide: RoleContext, useValue: { activeRoleId: () => 'establishment-manager' } },
        {
          provide: OperationalPeriodService,
          useValue: {
            selected: selectedPeriod,
            selectedEndKey: computed(() => selectedPeriod().key),
          },
        },
        {
          provide: ItsCaptureApiService,
          useValue: {
            getContext: () => context,
            getMonthlyReport,
            getCurrentIts2Report,
            prepareIts2Report,
            downloadMonthlyReportPdf: () => pdf,
            downloadIts1RegisterPdf: () => pdf,
          },
        },
      ],
    })
      .overrideComponent(ReportIts2, { set: { template: '' } })
      .compileComponents();
    fixture = TestBed.createComponent(ReportIts2);
    component = fixture.componentInstance;
    fixture.detectChanges();
    context.next({
      facilities: [
        {
          ...facility,
          type: 'CIS',
          municipality: { id: 'municipality-1', code: 'M1', name: 'Municipio QA' },
          region: { id: 'region-1', code: 'R1', name: 'Región QA' },
        },
      ],
      populationTypes: [],
      classifications: [],
    });
    context.complete();
    fixture.detectChanges();
  });

  function latestRequest() {
    const request = requests.at(-1);
    if (!request) throw new Error('No monthly report request was started');
    return request;
  }

  function resolve(request = latestRequest()) {
    request.report.next(monthly(request.month));
    request.report.complete();
    request.workflow.next(workflow(request.month));
    request.workflow.complete();
  }

  function selectPeriod(month: number, status: OperationalPeriod['status'] = 'ABIERTO') {
    selectedPeriod.set(period(month, status));
    fixture.detectChanges();
  }

  it('waits for both the monthly aggregate and workflow before releasing loading', () => {
    expect(requests).toHaveLength(1);
    expect(getMonthlyReport).toHaveBeenCalledWith(facility.id, 2026, 8);
    expect(getCurrentIts2Report).toHaveBeenCalledWith(facility.id, 2026, 8);
    const request = latestRequest();
    request.report.next(monthly(8));
    request.report.complete();
    expect(component['loading']()).toBe(true);
    expect(component['report']()).toBeNull();
    expect(component['canPrepare']).toBe(false);
    request.workflow.next(workflow(8));
    request.workflow.complete();
    expect(component['loading']()).toBe(false);
    expect(component['report']()?.month).toBe(8);
    expect(component['workflowReport']()?.month).toBe(8);
  });

  it('clears previous totals and editable header fields as soon as another period starts loading', () => {
    resolve();
    expect(component['total']).toBe(80);
    expect(component['attentionsUnder15']).toBe(8);
    selectPeriod(9);
    expect(component['loading']()).toBe(true);
    expect(component['report']()).toBeNull();
    expect(component['workflowReport']()).toBeNull();
    expect(component['total']).toBe(0);
    expect(component['attentionsUnder15']).toBeNull();
    expect(component['attentions15Plus']).toBeNull();
    expect(component['attentionTotalsSource']).toBe('');
    expect(component['canSubmit']).toBe(false);
    resolve();
    expect(component['total']).toBe(90);
    expect(component['attentionTotalsSource']).toBe('Estadística mes 9');
  });

  it.each(['success', 'error'])(
    'ignores a late %s from the old period without releasing the current loading state',
    (outcome) => {
      const previous = latestRequest();
      selectPeriod(9);
      if (outcome === 'success') resolve(previous);
      else previous.report.error(new Error('Old request failed'));
      expect(component['loading']()).toBe(true);
      expect(component['report']()).toBeNull();
      expect(component['workflowReport']()).toBeNull();
      expect(component['loadError']()).toBe('');
      resolve();
      expect(component['loading']()).toBe(false);
      expect(component['report']()?.month).toBe(9);
    },
  );

  it.each(['before-current', 'after-current'])(
    'ignores the previous period preparation when it finishes %s',
    (order) => {
      resolve();
      const notify = vi.spyOn(component.notify, 'emit');
      component['prepareWorkflow']();
      expect(prepareIts2Report).toHaveBeenCalledWith(
        expect.objectContaining({
          facilityId: facility.id,
          year: 2026,
          month: 8,
        }),
      );
      selectPeriod(9);
      if (order === 'after-current') resolve();
      preparation.next({ ...workflow(8), version: 2 });
      preparation.complete();
      expect(notify).not.toHaveBeenCalled();
      if (order === 'before-current') {
        expect(component['loading']()).toBe(true);
        expect(component['workflowReport']()).toBeNull();
        resolve();
      }
      expect(component['loading']()).toBe(false);
      expect(component['workflowReport']()?.id).toBe('workflow-9');
      expect(component['attentionsUnder15']).toBe(9);
    },
  );

  it.each(['CERRADO', 'BLOQUEADO'] as const)(
    'disables preparing and submitting a complete draft in a %s period',
    (status) => {
      resolve();
      expect(component['canPrepare']).toBe(true);
      expect(component['canSubmit']).toBe(true);
      selectPeriod(9, status);
      resolve();
      expect(component['loading']()).toBe(false);
      expect(component['workflowReport']()?.attentionTotalsComplete).toBe(true);
      expect(component['canPrepare']).toBe(false);
      expect(component['canSubmit']).toBe(false);
      component['prepareWorkflow']();
      expect(prepareIts2Report).not.toHaveBeenCalled();
    },
  );

  it.each(['downloadFilledIts1', 'downloadFilledIts2'] as const)(
    'does not let a previous %s completion release a newer period request',
    (download) => {
      resolve();
      component[download]();
      expect(component['loading']()).toBe(true);
      selectPeriod(9);
      pdf.complete();
      expect(component['loading']()).toBe(true);
      expect(component['canPrepare']).toBe(false);
      resolve();
      expect(component['loading']()).toBe(false);
      expect(component['report']()?.month).toBe(9);
    },
  );
});
