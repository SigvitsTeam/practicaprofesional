import { Component, DestroyRef, OnInit, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { RoleContext } from '../../core/role-context';
import { AuthService } from '../../core/auth.service';
import {
  ExportJobsApiService,
  type ExportJobRecord,
  type MunicipalExportRange,
} from '../../core/export-jobs-api.service';
import {
  ItsCaptureApiService,
  type EpidemiologicalWeekResponse,
} from '../../core/its-capture-api.service';
import { formatHondurasMonth, hondurasDateParts } from '../../core/honduras-date';
import { OperationalPeriodService } from '../../core/operational-period';
import { ExportQueueState } from './export-queue-state';

type ComparisonDimension = 'periods' | 'territories' | 'indicators';
interface AnnualEvaluationConfig {
  reportType: string;
  dimension: ComparisonDimension;
  rangeAStart: string;
  rangeAEnd: string;
  rangeBStart: string;
  rangeBEnd: string;
  territoryA: string;
  territoryB: string;
  indicatorA: string;
  indicatorB: string;
  format: string;
}
interface ExportOption {
  icon: string;
  title: string;
  detail: string;
  action: 'annual' | 'generate' | 'scoped' | 'its1' | 'municipal';
  reportType?: string;
  targetLevel?: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
  scopeLevel?: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
}
interface ScopedExportTarget {
  id: string;
  code: string;
  name: string;
}
interface ExportJob {
  id: string;
  report: string;
  period: string;
  format: 'XLSX' | 'PDF';
  status: 'Generado' | 'Generando' | 'Error';
  outputAvailable: boolean;
  downloadFilename?: string;
}
type MunicipalTimeUnit = MunicipalExportRange['timeUnit'];
interface MunicipalExportForm {
  municipalityId: string;
  format: 'XLSX' | 'PDF';
  timeUnit: MunicipalTimeUnit;
  startPeriod: string;
  endPeriod: string;
}

@Component({
  selector: 'app-exports',
  imports: [FormsModule],
  providers: [ExportQueueState],
  templateUrl: './exports.html',
  styleUrl: './exports.css',
})
export class Exports implements OnInit {
  readonly notify = output<string>();
  private readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly jobsApi = inject(ExportJobsApiService);
  private readonly itsCaptureApi = inject(ItsCaptureApiService);
  private readonly operationalPeriod = inject(OperationalPeriodService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly queue = inject(ExportQueueState);
  private its1FacilityId = '';
  protected readonly loading = signal(false);
  protected showAnnualEvaluation = false;
  protected showScopedExport = false;
  protected showMunicipalDownload = false;
  protected scopedOption: ExportOption | null = null;
  protected scopedTargets: ScopedExportTarget[] = [];
  protected selectedScopedTargetId = '';
  protected scopedFormat: 'XLSX' | 'PDF' = 'XLSX';
  protected scopedPeriod: { year: number; month: number; label: string } | null = null;
  protected municipalTargets: ScopedExportTarget[] = [];
  protected municipalWeeks: EpidemiologicalWeekResponse[] = [];
  protected municipalForm: MunicipalExportForm = this.emptyMunicipalForm();
  protected municipalFormSubmitted = false;
  protected municipalLoadError = '';
  protected municipalWeekError = '';
  protected readonly municipalWeeksLoading = signal(false);
  protected formSubmitted = false;

  protected readonly dimensions: { value: ComparisonDimension; label: string; detail: string }[] = [
    {
      value: 'periods',
      label: 'Períodos de tiempo',
      detail: 'Contrastar dos rangos del mismo alcance.',
    },
    {
      value: 'territories',
      label: 'Territorios',
      detail: 'Contrastar dos territorios autorizados.',
    },
    {
      value: 'indicators',
      label: 'Indicadores',
      detail: 'Contrastar dos indicadores en el mismo rango.',
    },
  ];
  protected readonly indicators = [
    'Total de casos ITS',
    'Casos nuevos',
    'Controles',
    'Tasa ITS por 1,000 atenciones',
    'Alertas territoriales',
  ];
  protected annualForm = this.emptyAnnualForm();
  protected annualPreview: AnnualEvaluationConfig | null = null;

  ngOnInit() {
    if (this.auth.isDemo() || this.isAdministrativeSuperadmin) return;
    this.queue.refresh();
    if (
      ['establishment-manager', 'coordination-digitizer'].includes(this.roleContext.activeRoleId())
    )
      this.itsCaptureApi
        .getContext()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (context) => {
            this.its1FacilityId = context.facilities[0]?.id ?? '';
          },
          error: () => this.notify.emit('No fue posible resolver el establecimiento para ITS-1.'),
        });
  }

  protected get demoMode() {
    return this.auth.isDemo();
  }

  protected get isAdministrativeSuperadmin() {
    return ['superadmin', 'regional-superadmin'].includes(this.roleContext.activeRoleId());
  }

  protected get exportOptions(): ExportOption[] {
    const role = this.roleContext.activeRoleId();
    if (this.isAdministrativeSuperadmin) return [];
    if (role === 'establishment-manager' || role === 'coordination-digitizer')
      return [
        {
          icon: '▦',
          title: 'ITS 1 del establecimiento',
          detail: 'Excel protegido · datos individuales autorizados',
          action: 'its1',
        },
        {
          icon: '◇',
          title: 'ITS 2 mensual',
          detail: 'Excel del período · alcance asignado',
          action: 'generate',
          reportType: 'ITS2_MONTHLY',
        },
        {
          icon: '↗',
          title: 'Evaluación anual propia',
          detail: 'General y comparativa',
          action: 'annual',
        },
        {
          icon: '⌖',
          title: 'Resumen territorial propio',
          detail: 'Procedencias agregadas',
          action: 'generate',
          reportType: 'TERRITORIAL_SUMMARY',
        },
      ];
    if (role === 'supervisor') return this.supervisorExportOptions();
    if (role === 'central-validator')
      return [
        {
          icon: '▣',
          title: 'Consolidado nacional',
          detail: 'Preliminar desde ITS 1 hasta el cierre oficial',
          action: 'generate',
          reportType: 'NATIONAL_CONSOLIDATED',
        },
        {
          icon: '◇',
          title: 'Consolidados regionales',
          detail: 'Disponibles aun con aprobación pendiente',
          action: 'scoped',
          reportType: 'REGIONAL_CONSOLIDATED',
          targetLevel: 'REGION',
          scopeLevel: 'REGION',
        },
        {
          icon: '↗',
          title: 'Evaluación anual nacional',
          detail: 'General y comparativa',
          action: 'annual',
        },
        {
          icon: '⌖',
          title: 'Reporte territorial nacional',
          detail: 'Indicadores agregados',
          action: 'generate',
          reportType: 'TERRITORIAL_SUMMARY',
        },
      ];
    if (role === 'municipal-coordinator')
      return [
        {
          icon: '◇',
          title: 'ITS 2 por establecimiento',
          detail: 'Seleccione un establecimiento autorizado',
          action: 'scoped',
          reportType: 'ITS2_MONTHLY',
          targetLevel: 'ESTABLECIMIENTO',
          scopeLevel: 'ESTABLECIMIENTO',
        },
        {
          icon: '▣',
          title: 'Consolidado municipal',
          detail: 'Disponible como preliminar antes de consolidar',
          action: 'municipal',
          reportType: 'MUNICIPAL_CONSOLIDATED',
        },
        {
          icon: '↗',
          title: 'Evaluación anual municipal',
          detail: 'General y comparativa',
          action: 'annual',
        },
        {
          icon: '⌖',
          title: 'Reporte territorial municipal',
          detail: 'Establecimientos y procedencias',
          action: 'generate',
          reportType: 'TERRITORIAL_SUMMARY',
        },
      ];
    return [
      {
        icon: '◇',
        title: 'Consolidados municipales',
        detail: 'Seleccione un municipio autorizado',
        action: 'scoped',
        reportType: 'MUNICIPAL_CONSOLIDATED',
        targetLevel: 'MUNICIPIO',
        scopeLevel: 'MUNICIPIO',
      },
      {
        icon: '▣',
        title: 'Consolidado regional',
        detail: 'Preliminar desde ITS 1 hasta la aprobación central',
        action: 'generate',
        reportType: 'REGIONAL_CONSOLIDATED',
      },
      {
        icon: '↗',
        title: 'Evaluación anual regional',
        detail: 'General y comparativa',
        action: 'annual',
      },
      {
        icon: '⌖',
        title: 'Reporte territorial regional',
        detail: 'Municipios y Redes',
        action: 'generate',
        reportType: 'TERRITORIAL_SUMMARY',
      },
    ];
  }

  protected get recentJobs(): ExportJob[] {
    if (this.isAdministrativeSuperadmin) return [];
    if (!this.auth.isDemo())
      return this.queue.jobs().map((job) => ({
        id: job.id,
        report: job.reportType.replaceAll('_', ' '),
        period: this.exportJobPeriod(job),
        format: job.format,
        status: (
          {
            PENDIENTE: 'Generando',
            PROCESANDO: 'Generando',
            COMPLETADO: 'Generado',
            FALLIDO: 'Error',
          } as const
        )[job.status],
        outputAvailable: job.outputAvailable,
        downloadFilename: this.exportJobFilename(job),
      }));
    const level =
      this.roleContext.activeRoleId() === 'establishment-manager'
        ? 'CIS Linda Coello'
        : this.roleContext.activeRoleId() === 'municipal-coordinator'
          ? 'Puerto Cortés'
          : this.roleContext.activeRoleId() === 'central-validator'
            ? 'Honduras'
            : 'Región de Cortés';
    return [
      {
        id: 'demo-1',
        report: `Consolidado · ${level}`,
        period: 'Julio 2026',
        format: 'XLSX',
        status: 'Generado',
        outputAvailable: true,
      },
      {
        id: 'demo-2',
        report: 'Evaluación anual comparativa',
        period: '2025 vs 2026',
        format: 'PDF',
        status: 'Generando',
        outputAvailable: false,
      },
      {
        id: 'demo-3',
        report: `Reporte territorial · ${level}`,
        period: 'Julio 2026',
        format: 'PDF',
        status: 'Generado',
        outputAvailable: true,
      },
    ];
  }

  protected selectExport(option: ExportOption) {
    if (this.loading()) return;
    if (option.reportType === 'MUNICIPAL_CONSOLIDATED') {
      this.openMunicipalDownload();
    } else if (option.action === 'annual') this.openAnnualEvaluation();
    else if (option.action === 'its1') {
      if (this.auth.isDemo())
        this.notify.emit(`${option.title} agregado a la cola de demostración.`);
      else this.queueIts1(option);
    } else if (option.action === 'scoped') {
      if (this.auth.isDemo())
        this.notify.emit(`${option.title} agregado a la cola de demostración.`);
      else this.openScopedExport(option);
    } else if (this.auth.isDemo())
      this.notify.emit(`${option.title} agregado a la cola de demostración.`);
    else this.queueExport(option);
  }

  private queueIts1(option: ExportOption) {
    if (!this.its1FacilityId) {
      this.notify.emit('No hay un establecimiento individual autorizado disponible.');
      return;
    }
    const { year, month } = this.activePeriod;
    this.loading.set(true);
    this.jobsApi
      .createIts1({
        idempotencyKey: crypto.randomUUID(),
        format: 'XLSX',
        facilityId: this.its1FacilityId,
        year,
        month,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (job) => {
          this.queue.record(job);
          this.notify.emit(`${option.title} agregado a la cola protegida.`);
        },
        error: () => {
          this.notify.emit('No fue posible solicitar ITS-1. Verifique permiso y establecimiento.');
        },
      });
  }

  protected download(job: ExportJob) {
    if (this.auth.isDemo()) {
      this.notify.emit('Descarga simulada registrada en auditoría.');
      return;
    }
    this.jobsApi
      .download(job.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download =
            job.downloadFilename ??
            `SIGVITS-${job.report.replaceAll(' ', '-')}.${job.format.toLowerCase()}`;
          link.click();
          URL.revokeObjectURL(url);
          this.notify.emit('Descarga autorizada y registrada en auditoría.');
        },
        error: () => this.notify.emit('El archivo no está disponible o su vigencia expiró.'),
      });
  }

  private queueExport(option: ExportOption) {
    const scope = this.currentScope();
    if (!scope || !option.reportType) {
      this.notify.emit('No hay un territorio autorizado disponible para esta exportación.');
      return;
    }
    this.loading.set(true);
    const { year, month } = this.activePeriod;
    this.jobsApi
      .create({
        idempotencyKey: crypto.randomUUID(),
        reportType: option.reportType,
        format: 'XLSX',
        scopeLevel: scope.level,
        ...(scope.territoryId ? { territoryId: scope.territoryId } : {}),
        year,
        month,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (job) => {
          this.queue.record(job);
          this.notify.emit(`${option.title} agregado a la cola persistente.`);
        },
        error: () => {
          this.notify.emit(
            'No fue posible crear el trabajo de exportación. Verifique alcance y permisos.',
          );
        },
      });
  }

  protected closeScopedExport() {
    if (this.loading()) return;
    this.showScopedExport = false;
    this.scopedOption = null;
    this.scopedPeriod = null;
  }

  protected generateScopedExport() {
    const option = this.scopedOption;
    if (
      this.loading() ||
      !option?.reportType ||
      !option.scopeLevel ||
      !this.selectedScopedTargetId ||
      !this.scopedPeriod
    )
      return;
    const { year, month } = this.scopedPeriod;
    if (option.reportType === 'ITS2_MONTHLY' && option.scopeLevel === 'ESTABLECIMIENTO') {
      this.downloadScopedIts2(year, month);
      return;
    }
    this.loading.set(true);
    this.jobsApi
      .create({
        idempotencyKey: crypto.randomUUID(),
        reportType: option.reportType,
        format: this.scopedFormat,
        scopeLevel: option.scopeLevel,
        territoryId: this.selectedScopedTargetId,
        year,
        month,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (job) => {
          this.queue.record(job);
          this.showScopedExport = false;
          this.scopedOption = null;
          this.scopedPeriod = null;
          this.notify.emit(`${option.title} agregado a la cola persistente.`);
        },
        error: () => {
          this.notify.emit(
            'No fue posible solicitar el documento para el territorio seleccionado.',
          );
        },
      });
  }

  protected get isDirectScopedDownload() {
    return (
      this.scopedOption?.reportType === 'ITS2_MONTHLY' &&
      this.scopedOption.scopeLevel === 'ESTABLECIMIENTO'
    );
  }

  private downloadScopedIts2(year: number, month: number) {
    const target = this.scopedTargets.find((item) => item.id === this.selectedScopedTargetId);
    if (!target) return;
    this.loading.set(true);
    const request =
      this.scopedFormat === 'XLSX'
        ? this.itsCaptureApi.downloadMonthlyReportXlsx(target.id, year, month)
        : this.itsCaptureApi.downloadMonthlyReportPdf(target.id, year, month);
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (blob) => {
          this.saveBlob(
            blob,
            `ITS-2-${target.code}-${year}-${String(month).padStart(2, '0')}.${this.scopedFormat.toLowerCase()}`,
          );
          this.showScopedExport = false;
          this.scopedOption = null;
          this.scopedPeriod = null;
          this.notify.emit(`ITS 2 de ${target.name} descargado en ${this.scopedFormat}.`);
        },
        error: (error) =>
          this.notify.emit(
            this.apiError(error, 'No fue posible descargar el ITS 2 del establecimiento.'),
          ),
      });
  }

  private openMunicipalDownload() {
    this.municipalTargets = [];
    this.municipalWeeks = [];
    this.municipalForm = this.emptyMunicipalForm();
    this.municipalFormSubmitted = false;
    this.municipalLoadError = '';
    this.municipalWeekError = '';
    this.showMunicipalDownload = true;
    if (this.auth.isDemo()) {
      this.municipalTargets = this.demoMunicipalTargets();
      this.municipalForm.municipalityId = this.municipalTargets[0]?.id ?? '';
      return;
    }
    this.loading.set(true);
    this.itsCaptureApi
      .getMunicipalConsolidationContext()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (context) => {
          this.municipalTargets = context.municipalities.map(({ id, code, name }) => ({
            id,
            code,
            name,
          }));
          this.municipalForm.municipalityId = this.municipalTargets[0]?.id ?? '';
          if (!this.municipalTargets.length)
            this.municipalLoadError =
              'No hay municipios autorizados disponibles para este consolidado.';
        },
        error: (error) => {
          this.municipalLoadError = this.apiError(
            error,
            'No fue posible cargar los municipios autorizados.',
          );
        },
      });
  }

  protected closeMunicipalDownload() {
    if (this.loading() || this.municipalWeeksLoading()) return;
    this.resetMunicipalDialog();
  }

  protected setMunicipalTimeUnit(timeUnit: MunicipalTimeUnit) {
    if (this.municipalForm.timeUnit === timeUnit) return;
    this.municipalForm.timeUnit = timeUnit;
    this.municipalFormSubmitted = false;
    this.municipalWeekError = '';
    if (timeUnit === 'MONTH') {
      const period = this.activePeriod;
      const key = `${period.year}-${String(period.month).padStart(2, '0')}`;
      this.municipalForm.startPeriod = key;
      this.municipalForm.endPeriod = key;
      return;
    }
    this.municipalForm.startPeriod = '';
    this.municipalForm.endPeriod = '';
    this.loadMunicipalWeeks();
  }

  protected setMunicipalStartPeriod(value: string) {
    this.municipalForm.startPeriod = value;
    const allowed = new Set(this.municipalEndPeriods.map((option) => option.key));
    if (!allowed.has(this.municipalForm.endPeriod)) this.municipalForm.endPeriod = value;
  }

  protected setMunicipalEndPeriod(value: string) {
    this.municipalForm.endPeriod = value;
  }

  protected get municipalMonthPeriods() {
    return this.operationalPeriod.periods();
  }

  protected get municipalWeekPeriods() {
    return this.municipalWeeks
      .filter((week) => week.active)
      .map((week) => ({ ...week, key: this.epidemiologicalWeekKey(week) }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  protected get municipalStartPeriods(): { key: string; label: string }[] {
    return this.municipalForm.timeUnit === 'MONTH'
      ? this.municipalMonthPeriods.map(({ key, label }) => ({ key, label }))
      : this.municipalWeekPeriods.map(({ key, label }) => ({ key, label }));
  }

  protected get municipalEndPeriods(): { key: string; label: string }[] {
    const start = this.municipalForm.startPeriod;
    return this.municipalStartPeriods.filter((period) => !start || period.key >= start);
  }

  protected get municipalRangeInvalid() {
    const form = this.municipalForm;
    const available = new Set(this.municipalStartPeriods.map((period) => period.key));
    return (
      !this.municipalTargets.some((target) => target.id === form.municipalityId) ||
      !available.has(form.startPeriod) ||
      !available.has(form.endPeriod) ||
      form.startPeriod > form.endPeriod ||
      this.municipalWeeksLoading()
    );
  }

  protected get municipalPeriodLabel() {
    const { timeUnit, startPeriod, endPeriod } = this.municipalForm;
    if (!startPeriod || !endPeriod) return 'Seleccione un inicio y un fin.';
    return this.rangeLabel({ timeUnit, startPeriod, endPeriod });
  }

  protected downloadMunicipalConsolidation() {
    this.municipalFormSubmitted = true;
    if (this.loading() || this.municipalRangeInvalid) return;
    const form = { ...this.municipalForm };
    const parameters: MunicipalExportRange = {
      timeUnit: form.timeUnit,
      startPeriod: form.startPeriod,
      endPeriod: form.endPeriod,
    };
    const periodLabel = this.rangeLabel(parameters);
    if (this.auth.isDemo()) {
      this.resetMunicipalDialog();
      this.notify.emit(`Consolidado municipal ITS-2 ${form.format} simulado para ${periodLabel}.`);
      return;
    }
    this.loading.set(true);
    this.jobsApi
      .create({
        idempotencyKey: crypto.randomUUID(),
        reportType: 'MUNICIPAL_CONSOLIDATED',
        format: form.format,
        scopeLevel: 'MUNICIPIO',
        territoryId: form.municipalityId,
        parameters,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (job) => {
          this.queue.record(job);
          this.resetMunicipalDialog();
          this.notify.emit(
            `Consolidado municipal ITS-2 ${form.format} solicitado para ${periodLabel}. Puede descargarlo desde la cola aunque la aprobación siga pendiente.`,
          );
        },
        error: (error) =>
          this.notify.emit(
            this.apiError(error, 'No fue posible generar el consolidado municipal ITS-2.'),
          ),
      });
  }

  private loadMunicipalWeeks() {
    if (this.municipalWeeksLoading()) return;
    if (this.municipalWeeks.length) {
      this.initializeMunicipalWeekRange();
      return;
    }
    if (this.auth.isDemo()) {
      this.municipalWeeks = this.demoEpidemiologicalWeeks();
      this.initializeMunicipalWeekRange();
      return;
    }
    const years = this.municipalMonthPeriods.map((period) => period.year);
    const fallbackYear = this.activePeriod.year;
    const startYear = years.length ? Math.min(...years) : fallbackYear;
    const endYear = years.length ? Math.max(...years) : fallbackYear;
    this.municipalWeeksLoading.set(true);
    this.itsCaptureApi
      .getEpidemiologicalWeeks(startYear, endYear)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.municipalWeeksLoading.set(false)),
      )
      .subscribe({
        next: (weeks) => {
          this.municipalWeeks = weeks
            .filter(
              (week) =>
                week.active &&
                Number.isInteger(week.year) &&
                Number.isInteger(week.weekNumber) &&
                week.weekNumber >= 1 &&
                week.weekNumber <= 53 &&
                /^\d{4}-\d{2}-\d{2}/.test(week.startDate) &&
                /^\d{4}-\d{2}-\d{2}/.test(week.endDate),
            )
            .map((week) => ({
              ...week,
              startDate: week.startDate.slice(0, 10),
              endDate: week.endDate.slice(0, 10),
            }));
          if (!this.municipalWeeks.length) {
            this.municipalWeekError =
              'No hay semanas epidemiológicas activas disponibles para el rango autorizado.';
            return;
          }
          this.initializeMunicipalWeekRange();
        },
        error: (error) => {
          this.municipalWeekError = this.apiError(
            error,
            'No fue posible cargar el calendario epidemiológico.',
          );
        },
      });
  }

  private initializeMunicipalWeekRange() {
    const weeks = this.municipalWeekPeriods;
    if (!weeks.length) return;
    const active = this.operationalPeriod.selected();
    const overlapping = active
      ? weeks.filter((week) => week.startDate <= active.endDate && week.endDate >= active.startDate)
      : [];
    const candidates = overlapping.length ? overlapping : [weeks.at(-1)!];
    this.municipalForm.startPeriod = candidates[0]?.key ?? '';
    this.municipalForm.endPeriod = candidates.at(-1)?.key ?? '';
  }

  private emptyMunicipalForm(): MunicipalExportForm {
    const { year, month } = this.activePeriod;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    return {
      municipalityId: '',
      format: 'XLSX',
      timeUnit: 'MONTH',
      startPeriod: period,
      endPeriod: period,
    };
  }

  private resetMunicipalDialog() {
    this.showMunicipalDownload = false;
    this.municipalTargets = [];
    this.municipalWeeks = [];
    this.municipalForm = this.emptyMunicipalForm();
    this.municipalFormSubmitted = false;
    this.municipalLoadError = '';
    this.municipalWeekError = '';
  }

  private demoMunicipalTargets(): ScopedExportTarget[] {
    const regional = this.currentScope()?.level === 'REGION';
    return [
      { id: 'demo-municipality-0506', code: '0506', name: 'Puerto Cortés' },
      ...(regional ? [{ id: 'demo-municipality-0503', code: '0503', name: 'Omoa' }] : []),
    ];
  }

  private demoEpidemiologicalWeeks(): EpidemiologicalWeekResponse[] {
    return [
      {
        id: 'demo-week-27',
        year: 2026,
        weekNumber: 27,
        startDate: '2026-06-28',
        endDate: '2026-07-04',
        active: true,
        label: 'SE 27 · 28 jun–4 jul 2026',
      },
      {
        id: 'demo-week-28',
        year: 2026,
        weekNumber: 28,
        startDate: '2026-07-05',
        endDate: '2026-07-11',
        active: true,
        label: 'SE 28 · 5–11 jul 2026',
      },
      {
        id: 'demo-week-29',
        year: 2026,
        weekNumber: 29,
        startDate: '2026-07-12',
        endDate: '2026-07-18',
        active: true,
        label: 'SE 29 · 12–18 jul 2026',
      },
      {
        id: 'demo-week-30',
        year: 2026,
        weekNumber: 30,
        startDate: '2026-07-19',
        endDate: '2026-07-25',
        active: true,
        label: 'SE 30 · 19–25 jul 2026',
      },
      {
        id: 'demo-week-31',
        year: 2026,
        weekNumber: 31,
        startDate: '2026-07-26',
        endDate: '2026-08-01',
        active: true,
        label: 'SE 31 · 26 jul–1 ago 2026',
      },
    ];
  }

  private epidemiologicalWeekKey(week: Pick<EpidemiologicalWeekResponse, 'year' | 'weekNumber'>) {
    return `${week.year}-W${String(week.weekNumber).padStart(2, '0')}`;
  }

  private exportJobPeriod(job: ExportJobRecord): string {
    const range = this.municipalExportRange(job.parameters);
    return range ? this.rangeLabel(range) : `${String(job.month).padStart(2, '0')}/${job.year}`;
  }

  private exportJobFilename(job: ExportJobRecord): string {
    const range =
      job.reportType === 'MUNICIPAL_CONSOLIDATED'
        ? this.municipalExportRange(job.parameters)
        : null;
    const period = range
      ? `${range.timeUnit === 'MONTH' ? 'MES' : 'SE'}-${range.startPeriod}_a_${range.endPeriod}`
      : `${job.year}-${String(job.month).padStart(2, '0')}`;
    return `SIGVITS-${job.reportType}-${period}.${job.format.toLowerCase()}`;
  }

  private municipalExportRange(value: Record<string, unknown> | null | undefined) {
    if (!value) return null;
    const timeUnit = value['timeUnit'];
    const startPeriod = value['startPeriod'];
    const endPeriod = value['endPeriod'];
    if (
      (timeUnit !== 'MONTH' && timeUnit !== 'EPIDEMIOLOGICAL_WEEK') ||
      typeof startPeriod !== 'string' ||
      typeof endPeriod !== 'string'
    )
      return null;
    const pattern =
      timeUnit === 'MONTH' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
    return pattern.test(startPeriod) && pattern.test(endPeriod)
      ? ({ timeUnit, startPeriod, endPeriod } satisfies MunicipalExportRange)
      : null;
  }

  private rangeLabel(range: MunicipalExportRange): string {
    if (range.timeUnit === 'MONTH') {
      const month = (value: string) => {
        const [year, number] = value.split('-').map(Number);
        return formatHondurasMonth(year!, number!);
      };
      const start = month(range.startPeriod);
      const end = month(range.endPeriod);
      return start === end ? start : `${start} – ${end}`;
    }
    const week = (value: string) => {
      const match = /^(\d{4})-W(\d{2})$/.exec(value);
      return match ? `SE ${Number(match[2])} de ${match[1]}` : value;
    };
    const start = week(range.startPeriod);
    const end = week(range.endPeriod);
    return start === end ? start : `${start} – ${end}`;
  }

  private saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private apiError(error: unknown, fallback: string): string {
    const response = error as { error?: { detail?: string; message?: string } };
    return (
      response.error?.detail ??
      response.error?.message ??
      (error instanceof Error ? error.message : fallback)
    );
  }

  private openScopedExport(option: ExportOption) {
    if (!option.targetLevel) return;
    const { year, month } = this.activePeriod;
    this.loading.set(true);
    this.itsCaptureApi
      .getTerritorialAnalytics(option.targetLevel, year, month)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.scopedTargets = result.rows.map(({ id, code, name }) => ({ id, code, name }));
          this.selectedScopedTargetId = this.scopedTargets[0]?.id ?? '';
          if (!this.selectedScopedTargetId) {
            this.notify.emit('No hay territorios autorizados disponibles para esta exportación.');
            return;
          }
          this.scopedOption = option;
          this.scopedPeriod = { year, month, label: formatHondurasMonth(year, month) };
          this.scopedFormat = 'XLSX';
          this.showScopedExport = true;
        },
        error: () => {
          this.notify.emit('No fue posible cargar los territorios autorizados.');
        },
      });
  }

  private currentScope(): { level: string; territoryId?: string } | null {
    const role = this.roleContext.activeRoleId();
    if (this.isAdministrativeSuperadmin) return null;
    if (!this.auth.isDemo()) {
      const effective = this.roleContext.effectiveScope?.();
      if (effective) return effective;
      if (typeof this.roleContext.institutionalProfile === 'function') return null;
    }
    if (role === 'central-validator') return { level: 'NACIONAL' };
    if (['regional-admin', 'supervisor'].includes(role)) return { level: 'REGION' };
    if (role === 'municipal-coordinator') return { level: 'MUNICIPIO' };
    return { level: 'ESTABLECIMIENTO' };
  }

  private get activePeriod() {
    return this.operationalPeriod.selected() ?? hondurasDateParts();
  }

  protected get territoryOptions() {
    if (this.isAdministrativeSuperadmin) return [];
    if (!this.auth.isDemo()) {
      const scope = this.currentScope();
      if (scope?.level === 'NACIONAL') return ['Honduras'];
      if (scope?.level === 'REGION') return ['Región autorizada'];
      if (scope?.level === 'MUNICIPIO') return ['Municipio autorizado'];
      if (scope?.level === 'ESTABLECIMIENTO') return ['Establecimiento autorizado'];
      return [];
    }
    switch (this.roleContext.activeRoleId()) {
      case 'central-validator':
        return [
          'Honduras',
          'Región de Cortés',
          'Región de Atlántida',
          'Región de Francisco Morazán',
        ];
      case 'regional-admin':
        return ['Región de Cortés', 'Puerto Cortés', 'Omoa', 'San Pedro Sula', 'Choloma'];
      case 'municipal-coordinator':
        return [
          'Puerto Cortés',
          'Policlínico Cornelio Moncada',
          'CIS Linda Coello',
          'UAPS La Pita',
          'CIS Bajamar',
        ];
      case 'supervisor':
        return ['Región de Cortés', 'Puerto Cortés', 'Red Puerto Cortés–Omoa'];
      default:
        return ['CIS Linda Coello'];
    }
  }

  protected get canCompareTerritories() {
    return this.territoryOptions.length > 1;
  }

  private supervisorExportOptions(): ExportOption[] {
    const scope = this.currentScope();
    if (scope?.level === 'MUNICIPIO')
      return [
        {
          icon: '◇',
          title: 'ITS 2 por establecimiento',
          detail: 'Seleccione un establecimiento autorizado',
          action: 'scoped',
          reportType: 'ITS2_MONTHLY',
          targetLevel: 'ESTABLECIMIENTO',
          scopeLevel: 'ESTABLECIMIENTO',
        },
        {
          icon: '▣',
          title: 'Resumen municipal',
          detail: 'Preliminar desde ITS 1 hasta el cierre oficial',
          action: 'generate',
          reportType: 'MUNICIPAL_CONSOLIDATED',
        },
        {
          icon: '↗',
          title: 'Evaluación anual municipal',
          detail: 'General y comparativa',
          action: 'annual',
        },
        {
          icon: '⌖',
          title: 'Reporte territorial municipal',
          detail: 'Indicadores agregados del alcance',
          action: 'generate',
          reportType: 'TERRITORIAL_SUMMARY',
        },
      ];
    if (scope?.level === 'ESTABLECIMIENTO')
      return [
        {
          icon: '◇',
          title: 'ITS 2 mensual',
          detail: 'Reporte agregado del establecimiento autorizado',
          action: 'generate',
          reportType: 'ITS2_MONTHLY',
        },
        {
          icon: '↗',
          title: 'Evaluación anual del establecimiento',
          detail: 'General y comparativa',
          action: 'annual',
        },
        {
          icon: '⌖',
          title: 'Reporte territorial del establecimiento',
          detail: 'Indicadores agregados del alcance',
          action: 'generate',
          reportType: 'TERRITORIAL_SUMMARY',
        },
      ];
    if (scope?.level !== 'REGION') return [];
    return [
      {
        icon: '◇',
        title: 'Consolidados municipales',
        detail: 'Seleccione un municipio autorizado',
        action: 'scoped',
        reportType: 'MUNICIPAL_CONSOLIDATED',
        targetLevel: 'MUNICIPIO',
        scopeLevel: 'MUNICIPIO',
      },
      {
        icon: '▣',
        title: 'Consolidado regional',
        detail: 'Preliminar desde ITS 1 hasta la aprobación central',
        action: 'generate',
        reportType: 'REGIONAL_CONSOLIDATED',
      },
      {
        icon: '↗',
        title: 'Evaluación anual regional',
        detail: 'General y comparativa',
        action: 'annual',
      },
      {
        icon: '⌖',
        title: 'Reporte territorial regional',
        detail: 'Municipios y Redes',
        action: 'generate',
        reportType: 'TERRITORIAL_SUMMARY',
      },
    ];
  }
  protected get invalidRanges() {
    const form = this.annualForm;
    return (
      !form.rangeAStart ||
      !form.rangeAEnd ||
      !form.rangeBStart ||
      !form.rangeBEnd ||
      form.rangeAStart > form.rangeAEnd ||
      form.rangeBStart > form.rangeBEnd
    );
  }

  protected openAnnualEvaluation() {
    if (this.loading()) return;
    this.annualForm = this.annualPreview ? { ...this.annualPreview } : this.emptyAnnualForm();
    if (!this.annualForm.territoryA) this.annualForm.territoryA = this.territoryOptions[0];
    if (!this.annualForm.territoryB)
      this.annualForm.territoryB = this.territoryOptions[1] ?? this.territoryOptions[0];
    this.formSubmitted = false;
    this.showAnnualEvaluation = true;
  }

  protected closeAnnualEvaluation() {
    if (this.loading()) return;
    this.showAnnualEvaluation = false;
  }

  protected setDimension(dimension: ComparisonDimension) {
    if (dimension === 'territories' && !this.canCompareTerritories) return;
    this.annualForm.dimension = dimension;
  }

  protected generateAnnualEvaluation() {
    if (this.loading()) return;
    this.formSubmitted = true;
    if (this.invalidRanges) return;
    const dimension =
      this.dimensions.find((item) => item.value === this.annualForm.dimension)?.label ?? 'Períodos';
    this.annualPreview = { ...this.annualForm };
    if (this.annualForm.format === 'Vista previa') {
      this.showAnnualEvaluation = false;
      this.notify.emit(`Evaluación anual configurada: comparación por ${dimension.toLowerCase()}.`);
      return;
    }
    this.queueAnnualEvaluation(this.annualPreview);
  }

  protected runAnnualEvaluation(config: AnnualEvaluationConfig) {
    if (this.loading()) return;
    if (config.format === 'Vista previa') {
      this.notify.emit('Vista previa actualizada.');
      return;
    }
    this.queueAnnualEvaluation(config);
  }

  private queueAnnualEvaluation(config: AnnualEvaluationConfig) {
    if (this.auth.isDemo()) {
      this.showAnnualEvaluation = false;
      this.notify.emit(`${config.format} agregado a la cola de demostración.`);
      return;
    }
    const scope = this.currentScope();
    if (!scope || config.dimension === 'territories') {
      this.notify.emit('La comparación solicitada no está disponible para el alcance activo.');
      return;
    }
    const [year, month] = config.rangeBEnd.split('-').map(Number);
    this.loading.set(true);
    this.jobsApi
      .create({
        idempotencyKey: crypto.randomUUID(),
        reportType: 'ANNUAL_COMPARISON',
        format: config.format === 'PDF' ? 'PDF' : 'XLSX',
        scopeLevel: scope.level,
        ...(scope.territoryId ? { territoryId: scope.territoryId } : {}),
        year: year!,
        month: month!,
        parameters: {
          dimension: config.dimension,
          rangeAStart: config.rangeAStart,
          rangeAEnd: config.rangeAEnd,
          rangeBStart: config.rangeBStart,
          rangeBEnd: config.rangeBEnd,
          indicatorA: this.indicatorKey(config.indicatorA),
          indicatorB: this.indicatorKey(config.indicatorB),
        },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (job) => {
          this.queue.record(job);
          this.showAnnualEvaluation = false;
          this.notify.emit(`${config.format} anual agregado a la cola persistente.`);
        },
        error: () => {
          this.notify.emit('No fue posible solicitar la comparación anual. Revise los rangos.');
        },
      });
  }

  private indicatorKey(label: string): string {
    return (
      {
        'Total de casos ITS': 'TOTAL_CASES',
        'Casos nuevos': 'NEW_CASES',
        Controles: 'CONTROLS',
        'Tasa ITS por 1,000 atenciones': 'RATE_PER_1000',
        'Alertas territoriales': 'ALERTS',
      }[label] ?? 'TOTAL_CASES'
    );
  }

  protected formatRange(start: string, end: string) {
    const formatter = new Intl.DateTimeFormat('es-HN', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const date = (value: string) =>
      formatter.format(new Date(`${value}-01T00:00:00Z`)).replace('.', '');
    return `${date(start)} – ${date(end)}`;
  }

  private emptyAnnualForm(): AnnualEvaluationConfig {
    const currentYear = this.operationalPeriod.selected()?.year ?? hondurasDateParts().year;
    return {
      reportType: 'Comparativo anual',
      dimension: 'periods' as ComparisonDimension,
      rangeAStart: `${currentYear - 1}-01`,
      rangeAEnd: `${currentYear - 1}-12`,
      rangeBStart: `${currentYear}-01`,
      rangeBEnd: `${currentYear}-12`,
      territoryA: '',
      territoryB: '',
      indicatorA: this.indicators[0],
      indicatorB: this.indicators[3],
      format: 'Vista previa',
    };
  }
}
