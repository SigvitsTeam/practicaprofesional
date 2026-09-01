import { Component, DestroyRef, OnInit, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { RoleContext } from '../../core/role-context';
import { AuthService } from '../../core/auth.service';
import { ExportJobsApiService } from '../../core/export-jobs-api.service';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
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
  action: 'annual' | 'generate' | 'scoped' | 'its1';
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
  template: string;
  status: 'Generado' | 'Generando' | 'Error';
  user: string;
  outputAvailable: boolean;
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
  protected scopedOption: ExportOption | null = null;
  protected scopedTargets: ScopedExportTarget[] = [];
  protected selectedScopedTargetId = '';
  protected scopedFormat: 'XLSX' | 'PDF' = 'XLSX';
  protected scopedPeriod: { year: number; month: number; label: string } | null = null;
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
    if (this.auth.isDemo()) return;
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

  protected get exportOptions(): ExportOption[] {
    const role = this.roleContext.activeRoleId();
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
          detail: 'Excel oficial · alcance asignado',
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
    if (role === 'central-validator' || role === 'superadmin')
      return [
        {
          icon: '▣',
          title: 'Consolidado nacional',
          detail: 'Excel · por región',
          action: 'generate',
          reportType: 'NATIONAL_CONSOLIDATED',
        },
        {
          icon: '◇',
          title: 'Consolidados regionales',
          detail: 'Seleccione una región autorizada',
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
          detail: 'Excel · establecimientos incluidos',
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
        detail: 'Excel · municipios incluidos',
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
    if (!this.auth.isDemo())
      return this.queue.jobs().map((job) => ({
        id: job.id,
        report: job.reportType.replaceAll('_', ' '),
        period: `${String(job.month).padStart(2, '0')}/${job.year}`,
        format: job.format,
        template: 'Vigente',
        status: (
          {
            PENDIENTE: 'Generando',
            PROCESANDO: 'Generando',
            COMPLETADO: 'Generado',
            FALLIDO: 'Error',
          } as const
        )[job.status],
        user: this.auth.user()?.name ?? 'Usuario actual',
        outputAvailable: job.outputAvailable,
      }));
    const role = this.roleContext.activeRole();
    const level =
      this.roleContext.activeRoleId() === 'establishment-manager'
        ? 'CIS Linda Coello'
        : this.roleContext.activeRoleId() === 'municipal-coordinator'
          ? 'Puerto Cortés'
          : ['superadmin', 'central-validator'].includes(this.roleContext.activeRoleId())
            ? 'Honduras'
            : 'Región de Cortés';
    return [
      {
        id: 'demo-1',
        report: `Consolidado · ${level}`,
        period: 'Julio 2026',
        format: 'XLSX',
        template: 'v3.2',
        status: 'Generado',
        user: role.userName,
        outputAvailable: true,
      },
      {
        id: 'demo-2',
        report: 'Evaluación anual comparativa',
        period: '2025 vs 2026',
        format: 'PDF',
        template: 'v1.4',
        status: 'Generando',
        user: role.userName,
        outputAvailable: false,
      },
      {
        id: 'demo-3',
        report: `Reporte territorial · ${level}`,
        period: 'Julio 2026',
        format: 'PDF',
        template: 'v1.0',
        status: 'Generado',
        user: role.userName,
        outputAvailable: true,
      },
    ];
  }

  protected selectExport(option: ExportOption) {
    if (this.loading()) return;
    if (option.action === 'annual') this.openAnnualEvaluation();
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
          link.download = `SIGVITS-${job.report.replaceAll(' ', '-')}.${job.format.toLowerCase()}`;
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
    if (['superadmin', 'central-validator'].includes(role)) return { level: 'NACIONAL' };
    if (['regional-superadmin', 'regional-admin', 'supervisor'].includes(role))
      return { level: 'REGION' };
    if (role === 'municipal-coordinator') return { level: 'MUNICIPIO' };
    return { level: 'ESTABLECIMIENTO' };
  }

  private get activePeriod() {
    return this.operationalPeriod.selected() ?? hondurasDateParts();
  }

  protected get territoryOptions() {
    if (!this.auth.isDemo()) {
      const role = this.roleContext.activeRoleId();
      if (['superadmin', 'central-validator'].includes(role)) return ['Honduras'];
      if (['regional-superadmin', 'regional-admin', 'supervisor'].includes(role))
        return ['Región autorizada'];
      if (role === 'municipal-coordinator') return ['Municipio autorizado'];
      return ['Establecimiento autorizado'];
    }
    switch (this.roleContext.activeRoleId()) {
      case 'superadmin':
      case 'central-validator':
        return [
          'Honduras',
          'Región de Cortés',
          'Región de Atlántida',
          'Región de Francisco Morazán',
        ];
      case 'regional-superadmin':
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
