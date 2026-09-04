import { Component, DestroyRef, effect, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  filter,
  finalize,
  forkJoin,
  throwError,
  type MonoTypeOperatorFunction,
} from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { OperationalPeriodService } from '../../core/operational-period';
import {
  Its2WorkflowReport,
  ItsCaptureApiService,
  MunicipalConsolidationReport,
  NationalConsolidationReport,
  RegionalConsolidationReport,
} from '../../core/its-capture-api.service';
import { RoleContext } from '../../core/role-context';

@Component({
  selector: 'app-consolidated',
  templateUrl: './consolidated.html',
  styleUrl: './consolidated.css',
})
export class Consolidated {
  readonly navigate = output<string>();
  readonly notify = output<string>();
  private readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operationalPeriod = inject(OperationalPeriodService);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly facilityReports = signal<Its2WorkflowReport[]>([]);
  protected readonly consolidation = signal<MunicipalConsolidationReport | null>(null);
  protected readonly municipalReports = signal<MunicipalConsolidationReport[]>([]);
  protected readonly regionalConsolidation = signal<RegionalConsolidationReport | null>(null);
  protected readonly regionalReports = signal<RegionalConsolidationReport[]>([]);
  protected readonly nationalConsolidation = signal<NationalConsolidationReport | null>(null);
  private requestVersion = 0;
  private municipalityId = '';
  private activeFacilities = 0;
  private regionId = '';
  private activeMunicipalities = 0;
  private activeRegions = 0;

  constructor() {
    effect(() => {
      this.roleContext.activeRoleId();
      const periodKey = this.operationalPeriod.selectedEndKey();
      if (periodKey) this.reload();
    });
  }

  private get year() {
    return this.operationalPeriod.selected()?.year ?? 0;
  }
  private get month() {
    return this.operationalPeriod.selected()?.month ?? 0;
  }
  protected get periodLabel() {
    return this.operationalPeriod.selected()?.label ?? '—';
  }

  get isLiveMunicipal() {
    return !this.auth.isDemo() && this.roleContext.activeRoleId() === 'municipal-coordinator';
  }
  get isLiveRegional() {
    const role = this.roleContext.activeRoleId();
    return !this.auth.isDemo() && (role === 'regional-admin' || role === 'regional-superadmin');
  }
  get isLiveNational() {
    return !this.auth.isDemo() && this.roleContext.activeRoleId() === 'central-validator';
  }

  reload() {
    const requestVersion = ++this.requestVersion;
    this.facilityReports.set([]);
    this.consolidation.set(null);
    this.municipalReports.set([]);
    this.regionalConsolidation.set(null);
    this.regionalReports.set([]);
    this.nationalConsolidation.set(null);
    this.activeFacilities = 0;
    this.activeMunicipalities = 0;
    this.activeRegions = 0;
    this.municipalityId = '';
    this.regionId = '';
    if (this.isLiveNational) {
      this.reloadNational(requestVersion);
      return;
    }
    if (this.isLiveRegional) {
      this.reloadRegional(requestVersion);
      return;
    }
    if (!this.isLiveMunicipal) return;
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      context: this.api.getMunicipalConsolidationContext(),
      reports: this.api.getMunicipalIts2Inbox(this.year, this.month),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ context, reports }) => {
          if (requestVersion !== this.requestVersion) return;
          this.facilityReports.set(reports);
          const municipality = context.municipalities[0];
          this.municipalityId = municipality?.id ?? '';
          this.activeFacilities = municipality?.activeFacilities ?? 0;
          if (!this.municipalityId) {
            this.loading.set(false);
            this.loadError.set('No hay reportes del municipio para determinar el contexto activo.');
            return;
          }
          this.api
            .getCurrentMunicipalConsolidation(this.municipalityId, this.year, this.month)
            .pipe(
              takeUntilDestroyed(this.destroyRef),
              finalize(() => {
                if (requestVersion === this.requestVersion) this.loading.set(false);
              }),
            )
            .subscribe({
              next: (report) => {
                if (requestVersion === this.requestVersion) this.consolidation.set(report);
              },
              error: () => {
                if (requestVersion === this.requestVersion)
                  this.loadError.set('No fue posible cargar el consolidado municipal.');
              },
            });
        },
        error: () => {
          if (requestVersion !== this.requestVersion) return;
          this.loading.set(false);
          this.loadError.set('No fue posible consultar la cobertura municipal.');
        },
      });
  }

  private reloadNational(requestVersion: number) {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      context: this.api.getNationalConsolidationContext(),
      reports: this.api.getCentralConsolidationInbox(this.year, this.month),
      current: this.api.getCurrentNationalConsolidation(this.year, this.month),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: ({ context, reports, current }) => {
          if (requestVersion !== this.requestVersion) return;
          this.activeRegions = context.activeRegions;
          this.regionalReports.set(reports);
          this.nationalConsolidation.set(current);
        },
        error: () => {
          if (requestVersion === this.requestVersion)
            this.loadError.set('No fue posible cargar el estado nacional.');
        },
      });
  }

  private reloadRegional(requestVersion: number) {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      context: this.api.getRegionalConsolidationContext(),
      reports: this.api.getRegionalConsolidationInbox(this.year, this.month),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ context, reports }) => {
          if (requestVersion !== this.requestVersion) return;
          this.municipalReports.set(reports);
          const region = context.regions[0];
          this.regionId = region?.id ?? '';
          this.activeMunicipalities = region?.activeMunicipalities ?? 0;
          if (!this.regionId) {
            this.loading.set(false);
            this.loadError.set('No hay una región activa asignada.');
            return;
          }
          this.api
            .getCurrentRegionalConsolidation(this.regionId, this.year, this.month)
            .pipe(
              takeUntilDestroyed(this.destroyRef),
              finalize(() => {
                if (requestVersion === this.requestVersion) this.loading.set(false);
              }),
            )
            .subscribe({
              next: (report) => {
                if (requestVersion === this.requestVersion) this.regionalConsolidation.set(report);
              },
              error: () => {
                if (requestVersion === this.requestVersion)
                  this.loadError.set('No fue posible cargar el consolidado regional.');
              },
            });
        },
        error: () => {
          if (requestVersion !== this.requestVersion) return;
          this.loading.set(false);
          this.loadError.set('No fue posible consultar la cobertura regional.');
        },
      });
  }

  prepare() {
    if (!this.municipalityId || this.loading()) return;
    if (this.view.completion !== 100) {
      this.notify.emit(
        `No se puede preparar todavía: faltan ${this.view.blockers} establecimiento(s) por aprobar en la bandeja de revisión.`,
      );
      return;
    }
    this.loading.set(true);
    this.api
      .prepareMunicipalConsolidation(this.municipalityId, this.year, this.month)
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (report) => {
          this.consolidation.set(report);
          this.notify.emit(`Consolidado municipal versión ${report.version} preparado y auditado.`);
        },
        error: (error) =>
          this.notify.emit(
            error.error?.detail ?? 'No fue posible preparar el consolidado municipal.',
          ),
      });
  }

  downloadMunicipal(format: 'XLSX' | 'PDF') {
    const report = this.consolidation();
    if (!report || this.loading()) return;
    this.loading.set(true);
    const request =
      format === 'XLSX'
        ? this.api.downloadMunicipalConsolidationXlsx(
            report.municipality.id,
            report.year,
            report.month,
          )
        : this.api.downloadMunicipalConsolidationPdf(
            report.municipality.id,
            report.year,
            report.month,
          );
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (blob) => {
          const extension = format.toLowerCase();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `ITS-2-Consolidado-Municipal-${report.municipality.code}-${report.year}-${String(report.month).padStart(2, '0')}.${extension}`;
          link.click();
          URL.revokeObjectURL(url);
          this.notify.emit(`Consolidado municipal ${format} descargado.`);
        },
        error: (error) =>
          this.notify.emit(
            error.error?.detail ??
              error.error?.message ??
              'No fue posible descargar el consolidado municipal.',
          ),
      });
  }

  submitRegion() {
    const report = this.consolidation();
    if (!report || this.loading()) return;
    this.loading.set(true);
    this.api
      .submitMunicipalConsolidation(report.id)
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (updated) => {
          this.consolidation.set(updated);
          this.notify.emit('Consolidado municipal enviado a la Región de Cortés.');
        },
        error: (error) =>
          this.notify.emit(error.error?.detail ?? 'No fue posible enviar el consolidado a región.'),
      });
  }

  prepareRegional() {
    if (!this.regionId || this.loading()) return;
    this.loading.set(true);
    this.api
      .prepareRegionalConsolidation(this.regionId, this.year, this.month)
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (report) => {
          this.regionalConsolidation.set(report);
          this.notify.emit(`Consolidado regional versión ${report.version} preparado y auditado.`);
        },
        error: (error) =>
          this.notify.emit(
            error.error?.detail ?? 'No fue posible preparar el consolidado regional.',
          ),
      });
  }

  submitCentral() {
    const report = this.regionalConsolidation();
    if (!report || this.loading()) return;
    this.loading.set(true);
    this.api
      .submitRegionalConsolidation(report.id)
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (updated) => {
          this.regionalConsolidation.set(updated);
          this.notify.emit('Consolidado regional enviado a Nivel Central.');
        },
        error: (error) =>
          this.notify.emit(
            error.error?.detail ?? 'No fue posible enviar el consolidado a Nivel Central.',
          ),
      });
  }

  prepareNational() {
    if (this.loading() || this.loadError()) return;
    this.loading.set(true);
    this.api
      .prepareNationalConsolidation(this.year, this.month)
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (report) => {
          this.nationalConsolidation.set(report);
          this.notify.emit(`Consolidado nacional versión ${report.version} preparado.`);
        },
        error: (error) =>
          this.notify.emit(
            error.error?.detail ?? 'No fue posible preparar el consolidado nacional.',
          ),
      });
  }

  finalizeNational() {
    const report = this.nationalConsolidation();
    if (!report || this.loading()) return;
    this.loading.set(true);
    this.api
      .finalizeNationalConsolidation(report.id)
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (updated) => {
          this.nationalConsolidation.set(updated);
          this.notify.emit('Consolidado nacional finalizado.');
        },
        error: (error) =>
          this.notify.emit(
            error.error?.detail ?? 'No fue posible finalizar el consolidado nacional.',
          ),
      });
  }

  closeNational(reason: string) {
    if (this.loading()) return;
    const report = this.nationalConsolidation();
    if (!report || reason.trim().length < 10) {
      this.notify.emit('Escriba un motivo de al menos 10 caracteres.');
      return;
    }
    this.loading.set(true);
    this.api
      .closeNationalConsolidation(report.id, reason.trim())
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (updated) => {
          this.nationalConsolidation.set(updated);
          this.notify.emit('Período cerrado oficialmente y auditado.');
        },
        error: (error) =>
          this.notify.emit(error.error?.detail ?? 'No fue posible cerrar el período.'),
      });
  }

  reopenNational(reason: string) {
    if (this.loading()) return;
    const report = this.nationalConsolidation();
    if (!report || reason.trim().length < 10) {
      this.notify.emit('La reapertura requiere un motivo de al menos 10 caracteres.');
      return;
    }
    this.loading.set(true);
    this.api
      .reopenNationalConsolidation(report.id, reason.trim())
      .pipe(this.forCurrentPeriod())
      .subscribe({
        next: (updated) => {
          this.nationalConsolidation.set(updated);
          this.notify.emit('Cierre reabierto excepcionalmente. Prepare una nueva versión.');
        },
        error: (error) =>
          this.notify.emit(error.error?.detail ?? 'No fue posible reabrir el cierre.'),
      });
  }

  private forCurrentPeriod<T>(): MonoTypeOperatorFunction<T> {
    const requestVersion = this.requestVersion;
    return (operation) =>
      operation.pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(() => requestVersion === this.requestVersion),
        catchError((error: unknown) =>
          requestVersion === this.requestVersion ? throwError(() => error) : EMPTY,
        ),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      );
  }

  get view() {
    const role = this.roleContext.activeRoleId();
    if (role === 'central-validator') {
      if (this.isLiveNational) {
        const reports = this.regionalReports();
        const current = this.nationalConsolidation();
        const expected = current?.expectedRegions ?? this.activeRegions;
        const approved = reports.filter((report) => report.status === 'APROBADO_CENTRAL').length;
        const review = reports.filter((report) => report.status === 'ENVIADO_A_CENTRAL').length;
        const returned = reports.filter(
          (report) => report.status === 'DEVUELTO_POR_CENTRAL',
        ).length;
        const pending = Math.max(0, expected - approved - review - returned);
        const completion = expected ? Math.round((approved / expected) * 100) : 0;
        return {
          level: 'nacional',
          source: 'regiones sanitarias',
          received: `${approved} de ${expected} aprobadas`,
          completion,
          approved,
          review,
          returned,
          pending,
          blockers: expected - approved,
          total:
            current?.sourceAttentionCount ??
            reports
              .filter((report) => report.status === 'APROBADO_CENTRAL')
              .reduce((sum, report) => sum + report.sourceAttentionCount, 0),
          newCases: 0,
          controls: 0,
          next: 'Publicación nacional',
          blocking:
            current?.status === 'CERRADO_OFICIAL'
              ? 'El período está cerrado oficialmente.'
              : current?.status === 'REABIERTO_AUTORIZADO'
                ? 'El cierre fue reabierto; debe prepararse una nueva versión.'
                : approved === expected
                  ? 'La cobertura regional está completa.'
                  : `Faltan ${expected - approved} regiones por aprobar.`,
          steps: [
            'ITS 2 institucional',
            'Consolidado municipal',
            'Consolidado regional',
            'Revisión central',
            'Publicación nacional',
          ],
          current: current?.status === 'CERRADO_OFICIAL' ? 5 : current ? 4 : 3,
        };
      }
      return {
        level: 'nacional',
        source: 'regiones sanitarias',
        received: '1 de 18 regiones',
        completion: 6,
        approved: 0,
        review: 1,
        returned: 0,
        pending: 17,
        blockers: 1,
        total: 280,
        newCases: 211,
        controls: 69,
        next: 'Publicación nacional',
        blocking: 'Cortés requiere validación y 17 regiones aún no han enviado.',
        steps: [
          'ITS 2 institucional',
          'Consolidado municipal',
          'Consolidado regional',
          'Revisión central',
          'Publicación nacional',
        ],
        current: 3,
      };
    }
    if (role === 'regional-admin' || role === 'regional-superadmin') {
      if (this.isLiveRegional) {
        const reports = this.municipalReports();
        const current = this.regionalConsolidation();
        const expected = current?.expectedMunicipalities ?? this.activeMunicipalities;
        const approved = reports.filter((report) => report.status === 'APROBADO_REGION').length;
        const review = reports.filter((report) => report.status === 'ENVIADO_A_REGION').length;
        const returned = reports.filter((report) => report.status === 'DEVUELTO_POR_REGION').length;
        const pending = Math.max(0, expected - approved - review - returned);
        const completion = expected ? Math.round((approved / expected) * 100) : 0;
        return {
          level: 'regional',
          source: 'municipios de Cortés',
          received: `${approved} de ${expected} aprobados`,
          completion,
          approved,
          review,
          returned,
          pending,
          blockers: expected - approved,
          total:
            current?.sourceAttentionCount ??
            reports
              .filter((report) => report.status === 'APROBADO_REGION')
              .reduce((sum, report) => sum + report.sourceAttentionCount, 0),
          newCases: 0,
          controls: 0,
          next: 'Envío a Nivel Central',
          blocking:
            current?.status === 'ENVIADO_A_CENTRAL'
              ? 'El consolidado está en revisión central.'
              : current?.status === 'DEVUELTO_POR_CENTRAL'
                ? 'Nivel Central devolvió el consolidado; debe recalcularse.'
                : approved === expected
                  ? 'La cobertura municipal está completa.'
                  : `Faltan ${expected - approved} municipios por aprobar.`,
          steps: [
            'ITS 2 institucional',
            'Consolidado municipal',
            'Revisión regional',
            'Consolidado de Cortés',
            'Nivel Central',
          ],
          current:
            current?.status === 'ENVIADO_A_CENTRAL' || current?.status === 'APROBADO_CENTRAL'
              ? 4
              : current
                ? 3
                : 2,
        };
      }
      return {
        level: 'regional',
        source: 'municipios de Cortés',
        received: '2 de 12 municipios',
        completion: 17,
        approved: 1,
        review: 1,
        returned: 0,
        pending: 10,
        blockers: 1,
        total: 280,
        newCases: 211,
        controls: 69,
        next: 'Envío a Nivel Central',
        blocking: 'Puerto Cortés sigue en revisión y 10 municipios no han enviado.',
        steps: [
          'ITS 2 institucional',
          'Consolidado municipal',
          'Revisión regional',
          'Consolidado de Cortés',
          'Nivel Central',
        ],
        current: 2,
      };
    }
    if (this.isLiveMunicipal) {
      const reports = this.facilityReports();
      const current = this.consolidation();
      const expected = current?.expectedFacilities ?? this.activeFacilities;
      const approved = reports.filter((report) => report.status === 'APROBADO_MUNICIPIO').length;
      const review = reports.filter((report) => report.status === 'ENVIADO_A_MUNICIPIO').length;
      const returned = reports.filter(
        (report) => report.status === 'DEVUELTO_POR_MUNICIPIO',
      ).length;
      const pending = Math.max(0, expected - approved - review - returned);
      const completion = expected ? Math.round((approved / expected) * 100) : 0;
      return {
        level: 'municipal',
        source: 'establecimientos de Puerto Cortés',
        received: `${approved} de ${expected} aprobados`,
        completion,
        approved,
        review,
        returned,
        pending,
        blockers: expected - approved,
        total:
          current?.sourceAttentionCount ??
          reports
            .filter((report) => report.status === 'APROBADO_MUNICIPIO')
            .reduce((sum, report) => sum + report.totalAttentions, 0),
        newCases: 0,
        controls: 0,
        next: 'Envío a Región de Cortés',
        blocking:
          current?.status === 'ENVIADO_A_REGION'
            ? 'El consolidado está en revisión regional.'
            : current?.status === 'DEVUELTO_POR_REGION'
              ? 'Región devolvió el consolidado; debe recalcularse.'
              : approved === expected
                ? 'La cobertura está completa y el consolidado puede prepararse.'
                : `Faltan ${expected - approved} establecimientos por aprobar.`,
        steps: [
          'Captura ITS 1',
          'Generación ITS 2',
          'Revisión municipal',
          'Consolidado de Puerto Cortés',
          'Región de Cortés',
        ],
        current:
          current?.status === 'ENVIADO_A_REGION' || current?.status === 'APROBADO_REGION'
            ? 4
            : current
              ? 3
              : 2,
      };
    }
    return {
      level: 'municipal',
      source: 'establecimientos de Puerto Cortés',
      received: '9 de 12 establecimientos',
      completion: 75,
      approved: 6,
      review: 2,
      returned: 1,
      pending: 3,
      blockers: 4,
      total: 184,
      newCases: 139,
      controls: 45,
      next: 'Envío a Región de Cortés',
      blocking: 'Hay 4 reportes que requieren acción antes de cerrar.',
      steps: [
        'Captura ITS 1',
        'Generación ITS 2',
        'Revisión municipal',
        'Consolidado de Puerto Cortés',
        'Región de Cortés',
      ],
      current: 2,
    };
  }
}
