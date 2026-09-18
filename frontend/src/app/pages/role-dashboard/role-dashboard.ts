import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { OperationalPeriodService } from '../../core/operational-period';
import {
  ItsCaptureApiService,
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsResponse,
} from '../../core/its-capture-api.service';
import { RoleMetric, RoleProfile, RoleTask } from '../../core/models';
import { RoleContext } from '../../core/role-context';
import {
  FacilityRecord,
  MunicipalityRecord,
  RegionRecord,
  TerritorialApiService,
} from '../../core/territorial-api.service';
import { ManagedUserRecord, UserAdminApiService } from '../../core/user-admin-api.service';

interface AdministrativeSnapshot {
  regions: RegionRecord[];
  municipalities: MunicipalityRecord[];
  facilities: FacilityRecord[];
  users: ManagedUserRecord[];
}

const PRELIMINARY_NOTICE =
  'Datos preliminares acumulados automáticamente desde ITS 1; están pendientes de depuración y aprobación institucional.';

@Component({
  selector: 'app-role-dashboard',
  templateUrl: './role-dashboard.html',
  styleUrl: './role-dashboard.css',
})
export class RoleDashboard {
  readonly role = input.required<RoleProfile>();
  readonly navigate = output<string>();
  readonly notify = output<string>();
  private readonly auth = inject(AuthService);
  private readonly roleContext = inject(RoleContext);
  private readonly api = inject(ItsCaptureApiService);
  private readonly territorialApi = inject(TerritorialApiService);
  private readonly userAdminApi = inject(UserAdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operationalPeriod = inject(OperationalPeriodService);
  private readonly rows = signal<TerritorialAnalyticsResponse['rows']>([]);
  private readonly administrative = signal<AdministrativeSnapshot | null>(null);
  protected readonly dataStatus = signal<'PRELIMINAR' | 'OFICIAL'>('PRELIMINAR');
  protected readonly dataNotice = signal(PRELIMINARY_NOTICE);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  private requestVersion = 0;

  protected readonly isAdministrative = computed(() =>
    ['superadmin', 'regional-superadmin'].includes(this.role().id),
  );
  protected readonly showPriorities = computed(
    () =>
      this.role().id !== 'supervisor' &&
      (!this.isAdministrative() || this.administrative() !== null),
  );

  protected readonly metrics = computed<RoleMetric[]>(() => {
    if (this.auth.isDemo()) return this.role().metrics;
    const administrative = this.administrative();
    if (this.isAdministrative()) {
      if (!administrative) {
        const value = this.loading() ? '…' : '—';
        return [
          {
            label: this.role().id === 'superadmin' ? 'Regiones activas' : 'Municipios activos',
            value,
            detail: 'Estructura habilitada en el alcance',
            tone: 'green',
          },
          {
            label: 'Establecimientos activos',
            value,
            detail: 'Configuración territorial',
            tone: 'blue',
          },
          {
            label: 'Usuarios habilitados',
            value,
            detail: 'Perfiles administrados',
            tone: 'purple',
          },
          {
            label: 'Configuración pendiente',
            value,
            detail: 'Identidades y validación territorial',
            tone: 'amber',
          },
        ];
      }
      const activeRegions = administrative.regions.filter((region) => region.active).length;
      const activeMunicipalities = administrative.municipalities.filter(
        (municipality) => municipality.active,
      ).length;
      const activeFacilities = administrative.facilities.filter(
        (facility) => facility.active,
      ).length;
      const activeUsers = administrative.users.filter((user) => user.active).length;
      const pendingConfiguration =
        administrative.municipalities.filter(
          (municipality) => municipality.active && !municipality.mapValidated,
        ).length +
        administrative.facilities.filter(
          (facility) =>
            facility.active && (!facility.hasCoordinates || !facility.coordinatesValidated),
        ).length +
        administrative.users.filter((user) => user.active && !user.hasExternalIdentity).length;
      return [
        {
          label: this.role().id === 'superadmin' ? 'Regiones activas' : 'Municipios activos',
          value: String(this.role().id === 'superadmin' ? activeRegions : activeMunicipalities),
          detail: 'Estructura habilitada en el alcance',
          tone: 'green',
        },
        {
          label: 'Establecimientos activos',
          value: String(activeFacilities),
          detail: `${administrative.facilities.length} configurados`,
          tone: 'blue',
        },
        {
          label: 'Usuarios habilitados',
          value: String(activeUsers),
          detail: `${administrative.users.length} perfiles administrados`,
          tone: 'purple',
        },
        {
          label: 'Configuración pendiente',
          value: String(pendingConfiguration),
          detail: 'Identidades, ubicaciones y validación territorial',
          tone: 'amber',
        },
      ];
    }
    const rows = this.rows();
    const withReport = rows.filter((row) => row.status !== 'SIN_REPORTE').length;
    return [
      {
        label: 'Territorios visibles',
        value: String(rows.length),
        detail: 'Dentro del alcance autorizado',
        tone: 'purple',
      },
      {
        label: 'Reportes vigentes',
        value: String(withReport),
        detail: `${rows.length - withReport} pendientes de preparación`,
        tone: 'green',
      },
      {
        label: 'Atenciones registradas',
        value: this.aggregateDisplay(rows, 'attentions'),
        detail: 'Suma automática desde ITS 1',
        tone: 'blue',
      },
      {
        label: 'Alertas abiertas',
        value: this.aggregateDisplay(rows, 'alerts'),
        detail: 'Observaciones que requieren seguimiento',
        tone: 'amber',
      },
    ];
  });

  protected readonly tasks = computed<RoleTask[]>(() => {
    if (this.auth.isDemo()) return this.role().tasks;
    const administrative = this.administrative();
    if (this.isAdministrative())
      return administrative ? this.administrativeTasks(administrative) : [];
    if (!this.showPriorities()) return [];
    const rows = this.rows();
    const missing = rows.filter((row) => row.status === 'SIN_REPORTE');
    const returned = rows.filter((row) => row.status.startsWith('DEVUELTO'));
    const alerts = rows.reduce((sum, row) => sum + (row.alerts ?? 0), 0);
    const alertsSuppressed = rows.some(
      (row) =>
        row.suppressedMetrics?.includes('alerts') ||
        row.complementarySuppressedMetrics?.includes('alerts'),
    );
    const tasks: RoleTask[] = [];
    const ownsFacilityWorkflow = ['establishment-manager', 'coordination-digitizer'].includes(
      this.role().id,
    );
    if (missing.length)
      tasks.push({
        title: `${missing.length} ${missing.length === 1 ? 'territorio' : 'territorios'} sin reporte vigente`,
        detail: this.sample(missing),
        status: 'Pendiente',
        target: ownsFacilityWorkflow ? 'Reporte ITS 2' : 'Consolidados',
      });
    if (returned.length)
      tasks.push({
        title: `${returned.length} ${returned.length === 1 ? 'reporte devuelto' : 'reportes devueltos'}`,
        detail: this.sample(returned),
        status: 'Corrección',
        target: ownsFacilityWorkflow ? 'Reporte ITS 2' : 'Bandeja de revisión',
      });
    if (alerts || alertsSuppressed)
      tasks.push({
        title: alertsSuppressed
          ? 'Hay observaciones abiertas con conteo protegido'
          : `${alerts} ${alerts === 1 ? 'observación abierta' : 'observaciones abiertas'}`,
        detail: 'Revise los reportes observados dentro de su alcance.',
        status: 'Revisión',
        target: ownsFacilityWorkflow ? 'Reporte ITS 2' : 'Bandeja de revisión',
      });
    if (!tasks.length)
      tasks.push({
        title: 'Sin alertas operativas',
        detail: 'Los reportes visibles no tienen pendientes detectados.',
        status: 'Al día',
        target: ownsFacilityWorkflow ? 'Reporte ITS 2' : 'Bandeja de revisión',
      });
    return tasks;
  });

  constructor() {
    effect(() => {
      const role = this.role();
      const demo = this.auth.isDemo();
      if (!['superadmin', 'regional-superadmin'].includes(role.id))
        this.operationalPeriod.selectedEndKey();
      this.load(role, demo);
    });
  }

  openTask(target: string | undefined, title: string) {
    if (target) this.navigate.emit(target);
    else this.notify.emit(`${title}: no requiere una acción adicional.`);
  }

  private load(role: RoleProfile, demo: boolean) {
    const requestVersion = ++this.requestVersion;
    this.rows.set([]);
    this.administrative.set(null);
    this.loadError.set('');
    this.dataStatus.set('PRELIMINAR');
    this.dataNotice.set(PRELIMINARY_NOTICE);
    if (demo) {
      this.loading.set(false);
      return;
    }
    if (['superadmin', 'regional-superadmin'].includes(role.id)) {
      this.loadAdministrative(requestVersion);
      return;
    }
    const level = this.levelFor(role);
    const period = this.operationalPeriod.selected();
    if (!period) return;
    const { year, month } = period;
    this.loading.set(true);
    this.api
      .getTerritorialAnalytics(level, year, month)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          if (requestVersion !== this.requestVersion) return;
          this.rows.set(result.rows);
          this.dataStatus.set(result.dataStatus);
          this.dataNotice.set(result.notice);
        },
        error: () => {
          if (requestVersion === this.requestVersion)
            this.loadError.set('No fue posible cargar los indicadores reales del panel.');
        },
      });
  }

  private loadAdministrative(requestVersion: number) {
    this.loading.set(true);
    forkJoin({
      regions: this.territorialApi.listRegions(),
      catalog: this.territorialApi.listCatalog(),
      users: this.userAdminApi.list(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.requestVersion) this.loading.set(false);
        }),
      )
      .subscribe({
        next: ({ regions, catalog, users }) => {
          if (requestVersion !== this.requestVersion) return;
          this.administrative.set({
            regions,
            municipalities: catalog.municipalities,
            facilities: catalog.facilities,
            users,
          });
        },
        error: () => {
          if (requestVersion === this.requestVersion)
            this.loadError.set('No fue posible cargar el estado administrativo del alcance.');
        },
      });
  }

  private administrativeTasks(snapshot: AdministrativeSnapshot): RoleTask[] {
    const tasks: RoleTask[] = [];
    const identities = snapshot.users.filter((user) => user.active && !user.hasExternalIdentity);
    const missingCoordinates = snapshot.facilities.filter(
      (facility) => facility.active && !facility.hasCoordinates,
    );
    const coordinateReferences = snapshot.facilities.filter(
      (facility) => facility.active && facility.hasCoordinates && !facility.coordinatesValidated,
    );
    const maps = snapshot.municipalities.filter(
      (municipality) => municipality.active && !municipality.mapValidated,
    );
    if (identities.length)
      tasks.push({
        title: `${identities.length} ${identities.length === 1 ? 'usuario sin identidad vinculada' : 'usuarios sin identidad vinculada'}`,
        detail: 'Complete la habilitación del acceso institucional.',
        status: 'Usuarios',
        target: 'Administración',
      });
    if (missingCoordinates.length)
      tasks.push({
        title: `${missingCoordinates.length} ${missingCoordinates.length === 1 ? 'establecimiento sin coordenadas' : 'establecimientos sin coordenadas'}`,
        detail: this.sampleAdministrative(missingCoordinates),
        status: 'Territorio',
        target: 'Administración',
      });
    if (coordinateReferences.length)
      tasks.push({
        title: `${coordinateReferences.length} ${coordinateReferences.length === 1 ? 'ubicación de referencia pendiente de validación GPS' : 'ubicaciones de referencia pendientes de validación GPS'}`,
        detail: this.sampleAdministrative(coordinateReferences),
        status: 'Territorio',
        target: 'Administración',
      });
    if (maps.length)
      tasks.push({
        title: `${maps.length} ${maps.length === 1 ? 'municipio con mapa pendiente' : 'municipios con mapa pendiente'}`,
        detail: this.sampleAdministrative(maps),
        status: 'Territorio',
        target: 'Administración',
      });
    if (!tasks.length)
      tasks.push({
        title: 'Configuración administrativa al día',
        detail: 'No se detectan identidades o validaciones territoriales pendientes.',
        status: 'Al día',
        target: 'Administración',
      });
    return tasks;
  }

  private sampleAdministrative(rows: readonly { name: string }[]): string {
    const names = rows
      .slice(0, 3)
      .map((row) => row.name)
      .join(', ');
    return rows.length > 3 ? `${names} y ${rows.length - 3} más.` : names;
  }

  private levelFor(role: RoleProfile): TerritorialAnalyticsLevel {
    if (!this.auth.isDemo()) {
      const scope = this.roleContext.effectiveScope?.();
      if (scope?.level === 'NACIONAL') return 'REGION';
      if (scope?.level === 'REGION') return 'MUNICIPIO';
      if (scope) return 'ESTABLECIMIENTO';
    }
    if (['superadmin', 'central-validator'].includes(role.id)) return 'REGION';
    if (['regional-superadmin', 'regional-admin', 'supervisor'].includes(role.id))
      return 'MUNICIPIO';
    return 'ESTABLECIMIENTO';
  }

  private sample(rows: TerritorialAnalyticsResponse['rows']): string {
    const names = rows
      .slice(0, 3)
      .map((row) => row.name)
      .join(', ');
    return rows.length > 3 ? `${names} y ${rows.length - 3} más.` : names;
  }

  private aggregateDisplay(
    rows: TerritorialAnalyticsResponse['rows'],
    metric: 'attentions' | 'alerts',
  ): string {
    if (
      rows.some(
        (row) =>
          row.suppressedMetrics?.includes(metric) ||
          row.complementarySuppressedMetrics?.includes(metric),
      )
    )
      return 'Protegido';
    return String(rows.reduce((sum, row) => sum + (row[metric] ?? 0), 0));
  }
}
