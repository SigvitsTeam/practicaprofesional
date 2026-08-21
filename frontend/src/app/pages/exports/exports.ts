import { Component, OnInit, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoleContext } from '../../core/role-context';
import { AuthService } from '../../core/auth.service';
import { ExportJobsApiService, type ExportJobRecord } from '../../core/export-jobs-api.service';

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
  action: 'annual' | 'generate' | 'planned';
  reportType?: string;
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
  templateUrl: './exports.html',
  styleUrl: './exports.css',
})
export class Exports implements OnInit {
  readonly notify = output<string>();
  private readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly jobsApi = inject(ExportJobsApiService);
  protected liveJobs: ExportJobRecord[] = [];
  protected loading = false;
  protected showAnnualEvaluation = false;
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
    'Casos en menores de 15 años',
    'Casos en mayores de 15 años',
  ];
  protected annualForm = this.emptyAnnualForm();
  protected annualPreview: AnnualEvaluationConfig | null = null;

  ngOnInit() {
    if (this.auth.isDemo()) return;
    this.loading = true;
    this.jobsApi.list().subscribe({
      next: (jobs) => {
        this.liveJobs = jobs;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notify.emit('No fue posible cargar la cola real de exportaciones.');
      },
    });
  }

  protected get exportOptions(): ExportOption[] {
    const role = this.roleContext.activeRoleId();
    if (role === 'establishment-manager')
      return [
        {
          icon: '▦',
          title: 'ITS 1 del establecimiento',
          detail: 'Generador especializado pendiente',
          action: 'planned',
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
          detail: 'Generador especializado pendiente',
          action: 'planned',
        },
        {
          icon: '◇',
          title: 'Consolidados regionales',
          detail: 'Generador especializado pendiente',
          action: 'planned',
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
          detail: 'Generador especializado pendiente',
          action: 'planned',
        },
        {
          icon: '▣',
          title: 'Consolidado municipal',
          detail: 'Generador especializado pendiente',
          action: 'planned',
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
        detail: 'Generador especializado pendiente',
        action: 'planned',
      },
      {
        icon: '▣',
        title: 'Consolidado regional',
        detail: 'Generador especializado pendiente',
        action: 'planned',
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
      return this.liveJobs.map((job) => ({
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
    if (option.action === 'annual') this.openAnnualEvaluation();
    else if (option.action === 'planned')
      this.notify.emit(`${option.title}: el generador especializado aún está pendiente.`);
    else if (this.auth.isDemo())
      this.notify.emit(`${option.title} agregado a la cola de demostración.`);
    else this.queueExport(option);
  }

  protected download(job: ExportJob) {
    if (this.auth.isDemo()) {
      this.notify.emit('Descarga simulada registrada en auditoría.');
      return;
    }
    this.jobsApi.download(job.id).subscribe({
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
    this.loading = true;
    const now = new Date();
    this.jobsApi
      .create({
        idempotencyKey: crypto.randomUUID(),
        reportType: option.reportType,
        format: 'XLSX',
        scopeLevel: scope.level,
        ...(scope.territoryId ? { territoryId: scope.territoryId } : {}),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      })
      .subscribe({
        next: (job) => {
          this.loading = false;
          this.liveJobs = [job, ...this.liveJobs.filter((item) => item.id !== job.id)];
          this.notify.emit(`${option.title} agregado a la cola persistente.`);
        },
        error: () => {
          this.loading = false;
          this.notify.emit(
            'No fue posible crear el trabajo de exportación. Verifique alcance y permisos.',
          );
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
    this.annualForm = this.annualPreview ? { ...this.annualPreview } : this.emptyAnnualForm();
    if (!this.annualForm.territoryA) this.annualForm.territoryA = this.territoryOptions[0];
    if (!this.annualForm.territoryB)
      this.annualForm.territoryB = this.territoryOptions[1] ?? this.territoryOptions[0];
    this.formSubmitted = false;
    this.showAnnualEvaluation = true;
  }

  protected closeAnnualEvaluation() {
    this.showAnnualEvaluation = false;
  }

  protected setDimension(dimension: ComparisonDimension) {
    if (dimension === 'territories' && !this.canCompareTerritories) return;
    this.annualForm.dimension = dimension;
  }

  protected generateAnnualEvaluation() {
    this.formSubmitted = true;
    if (this.invalidRanges) return;
    const dimension =
      this.dimensions.find((item) => item.value === this.annualForm.dimension)?.label ?? 'Períodos';
    this.annualPreview = { ...this.annualForm };
    this.showAnnualEvaluation = false;
    this.notify.emit(`Evaluación anual configurada: comparación por ${dimension.toLowerCase()}.`);
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
    return {
      reportType: 'Comparativo anual',
      dimension: 'periods' as ComparisonDimension,
      rangeAStart: '2025-01',
      rangeAEnd: '2025-12',
      rangeBStart: '2026-01',
      rangeBEnd: '2026-12',
      territoryA: '',
      territoryB: '',
      indicatorA: this.indicators[0],
      indicatorB: this.indicators[3],
      format: 'Vista previa',
    };
  }
}
