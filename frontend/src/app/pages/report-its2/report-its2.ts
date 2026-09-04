import { Component, DestroyRef, effect, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { formatHondurasMonth } from '../../core/honduras-date';
import { EstablishmentContext } from '../../core/establishment-context';
import {
  Its2WorkflowReport,
  ItsCaptureApiService,
  ItsMonthlyReportResponse,
} from '../../core/its-capture-api.service';
import { RoleContext } from '../../core/role-context';
import { OperationalPeriodService } from '../../core/operational-period';
import { EstablishmentSelector } from '../../shared/establishment-selector/establishment-selector';

@Component({
  selector: 'app-report-its2',
  imports: [EstablishmentSelector, FormsModule],
  templateUrl: './report-its2.html',
  styleUrl: './report-its2.css',
})
export class ReportIts2 implements OnInit {
  readonly notify = output<string>();
  protected readonly context = inject(EstablishmentContext);
  protected readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operationalPeriod = inject(OperationalPeriodService);
  protected readonly report = signal<ItsMonthlyReportResponse | null>(null);
  protected readonly workflowReport = signal<Its2WorkflowReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  private readonly contextReady = signal(false);
  private requestVersion = 0;
  protected attentionsUnder15: number | null = null;
  protected attentions15Plus: number | null = null;
  protected attentionTotalsSource = '';

  constructor() {
    effect(() => {
      const facilityId = this.context.selected().id;
      this.operationalPeriod.selectedEndKey();
      if (this.contextReady() && facilityId) this.loadReport(facilityId);
    });
  }

  protected get year() {
    return this.operationalPeriod.selected()?.year ?? 0;
  }
  protected get month() {
    return this.operationalPeriod.selected()?.month ?? 0;
  }
  protected get periodLabel() {
    return this.year && this.month ? formatHondurasMonth(this.year, this.month) : '—';
  }

  ngOnInit() {
    if (this.auth.isDemo()) return;
    this.loading.set(true);
    this.api
      .getContext()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (context) => {
          this.context.replace(
            context.facilities.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              type: item.type === 'POLICLINICO' ? 'Policlínico' : (item.type as 'CIS' | 'UAPS'),
            })),
          );
          this.contextReady.set(true);
          const facilityId = this.context.selected().id;
          if (!facilityId) this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set('No fue posible cargar los establecimientos autorizados.');
        },
      });
  }

  protected get canSelectEstablishment() {
    return this.roleContext.activeRoleId() === 'coordination-digitizer';
  }

  protected get total() {
    return this.report()?.totalAttentions ?? 0;
  }
  protected get newCases() {
    return this.report()?.rows.reduce((sum, row) => sum + row.diagnosis.newCases, 0) ?? 0;
  }
  protected get controls() {
    return this.report()?.rows.reduce((sum, row) => sum + row.diagnosis.controls, 0) ?? 0;
  }
  protected get correctionRequested() {
    return this.workflowReport()?.status === 'DEVUELTO_POR_MUNICIPIO';
  }
  protected get workflowStatus() {
    return (
      {
        BORRADOR: 'Borrador',
        ENVIADO_A_MUNICIPIO: 'Enviado a municipio',
        DEVUELTO_POR_MUNICIPIO: 'Devuelto por municipio',
        APROBADO_MUNICIPIO: 'Aprobado municipal',
      } as const
    )[this.workflowReport()?.status ?? 'BORRADOR'];
  }
  protected get canPrepare() {
    const status = this.workflowReport()?.status;
    return (
      !this.loading() &&
      !this.loadError() &&
      this.contextReady() &&
      Boolean(this.context.selected().id) &&
      this.operationalPeriod.selected()?.status === 'ABIERTO' &&
      (!status || status === 'BORRADOR' || status === 'DEVUELTO_POR_MUNICIPIO')
    );
  }
  protected get canSubmit() {
    return (
      !this.loading() &&
      !this.loadError() &&
      this.operationalPeriod.selected()?.status === 'ABIERTO' &&
      this.workflowReport()?.status === 'BORRADOR' &&
      Boolean(this.workflowReport()?.attentionTotalsComplete)
    );
  }

  protected classificationTotal(classificationCode: string) {
    const rows =
      this.report()?.rows.filter((row) => row.classificationCode === classificationCode) ?? [];
    return {
      male: rows.reduce((sum, row) => sum + row.sex.male, 0),
      female: rows.reduce((sum, row) => sum + row.sex.female, 0),
      newCases: rows.reduce((sum, row) => sum + row.diagnosis.newCases, 0),
      controls: rows.reduce((sum, row) => sum + row.diagnosis.controls, 0),
    };
  }

  protected reload() {
    const facilityId = this.context.selected().id;
    if (facilityId) this.loadReport(facilityId);
  }

  protected prepareWorkflow() {
    if (!this.canPrepare) return;
    const facilityId = this.context.selected().id;
    if (
      !facilityId ||
      this.attentionsUnder15 === null ||
      this.attentions15Plus === null ||
      !this.attentionTotalsSource.trim()
    ) {
      this.notify.emit('Complete los totales de atenciones y su fuente.');
      return;
    }
    const requestVersion = this.requestVersion;
    this.loading.set(true);
    this.api
      .prepareIts2Report({
        facilityId,
        year: this.year,
        month: this.month,
        attentionsUnder15: this.attentionsUnder15,
        attentions15Plus: this.attentions15Plus,
        attentionTotalsSource: this.attentionTotalsSource.trim(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (workflow) => {
          if (requestVersion !== this.requestVersion) return;
          this.setWorkflow(workflow);
          this.notify.emit(`Borrador ITS-2 versión ${workflow.version} preparado.`);
        },
        error: (error) => {
          if (requestVersion === this.requestVersion)
            this.notify.emit(error.error?.detail ?? 'No fue posible preparar el ITS-2.');
        },
      });
  }

  protected submitWorkflow() {
    if (!this.canSubmit) return;
    const current = this.workflowReport();
    if (!current) return;
    const requestVersion = this.requestVersion;
    this.loading.set(true);
    this.api
      .submitIts2Report(current.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (workflow) => {
          if (requestVersion !== this.requestVersion) return;
          this.setWorkflow(workflow);
          this.notify.emit('ITS-2 enviado a coordinación municipal.');
        },
        error: (error) => {
          if (requestVersion === this.requestVersion)
            this.notify.emit(error.error?.detail ?? 'No fue posible enviar el ITS-2.');
        },
      });
  }

  protected downloadFilledIts2() {
    this.downloadIts2('pdf');
  }

  protected downloadFilledIts2Xlsx() {
    this.downloadIts2('xlsx');
  }

  private downloadIts2(format: 'xlsx' | 'pdf') {
    if (this.loading()) return;
    const requestVersion = this.requestVersion;
    const facility = this.context.selected();
    const { year, month } = this;
    if (!facility.id) {
      this.notify.emit('Inicie sesión para generar el ITS-2 con datos reales.');
      return;
    }
    this.loading.set(true);
    const download =
      format === 'xlsx'
        ? this.api.downloadMonthlyReportXlsx(facility.id, year, month)
        : this.api.downloadMonthlyReportPdf(facility.id, year, month);
    download
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (blob) =>
          this.downloadBlob(
            blob,
            `ITS-2-${facility.code}-${year}-${String(month).padStart(2, '0')}.${format}`,
            `ITS-2 oficial en ${format.toUpperCase()} generado y descargado.`,
          ),
        error: () => this.notify.emit(`No fue posible generar el ${format.toUpperCase()} ITS-2.`),
      });
  }

  protected downloadFilledIts1() {
    this.downloadIts1('pdf');
  }

  protected downloadFilledIts1Xlsx() {
    this.downloadIts1('xlsx');
  }

  private downloadIts1(format: 'xlsx' | 'pdf') {
    if (this.loading()) return;
    const requestVersion = this.requestVersion;
    const facility = this.context.selected();
    const { year, month } = this;
    if (!facility.id) {
      this.notify.emit('Inicie sesión para generar el ITS-1 con datos reales.');
      return;
    }
    this.loading.set(true);
    const download =
      format === 'xlsx'
        ? this.api.downloadIts1RegisterXlsx(facility.id, year, month)
        : this.api.downloadIts1RegisterPdf(facility.id, year, month);
    download
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (blob) =>
          this.downloadBlob(
            blob,
            `ITS-1-${facility.code}-${year}-${String(month).padStart(2, '0')}.${format}`,
            `ITS-1 oficial en ${format.toUpperCase()} generado y descargado.`,
          ),
        error: () => this.notify.emit(`No fue posible generar el ${format.toUpperCase()} ITS-1.`),
      });
  }

  private downloadBlob(blob: Blob, filename: string, message: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    this.notify.emit(message);
  }

  private loadReport(facilityId: string) {
    const requestVersion = ++this.requestVersion;
    const { year, month } = this;
    this.report.set(null);
    this.setWorkflow(null);
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      report: this.api.getMonthlyReport(facilityId, year, month),
      workflow: this.api.getCurrentIts2Report(facilityId, year, month),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: ({ report, workflow }) => {
          if (requestVersion !== this.requestVersion) return;
          this.report.set(report);
          this.setWorkflow(workflow, report);
        },
        error: () => {
          if (requestVersion !== this.requestVersion) return;
          this.report.set(null);
          this.loadError.set('No fue posible generar el consolidado ITS-2 del período.');
        },
      });
  }

  private setWorkflow(workflow: Its2WorkflowReport | null, report?: ItsMonthlyReportResponse) {
    this.workflowReport.set(workflow);
    this.attentionsUnder15 = report?.attentionsUnder15 ?? workflow?.attentionsUnder15 ?? null;
    this.attentions15Plus = report?.attentions15Plus ?? workflow?.attentions15Plus ?? null;
    this.attentionTotalsSource = report
      ? 'Calculado automáticamente desde las atenciones ITS-1 activas.'
      : (workflow?.attentionTotalsSource ?? '');
  }
}
