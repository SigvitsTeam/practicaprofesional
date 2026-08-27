import { Component, DestroyRef, effect, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import {
  formatHondurasDateTime,
  formatHondurasMonth,
  hondurasTodayIso,
} from '../../core/honduras-date';
import { OperationalPeriodService } from '../../core/operational-period';
import { RoleContext } from '../../core/role-context';
import {
  HealthNetworkRecord,
  RegionRecord,
  TerritorialApiService,
  TerritorialAuditEventRecord,
} from '../../core/territorial-api.service';

type NetworkTab = 'summary' | 'municipalities' | 'consolidated' | 'history';
type NetworkMetric = 'total' | 'newCases' | 'controls' | 'reports';
type NetworkView = {
  id: string;
  regionId: string;
  regionName: string;
  code: string;
  name: string;
  municipalities: number;
  reports: string;
  total: number;
  status: string;
  rawStatus: string;
  active: boolean;
  configured: boolean;
  memberIds: string[];
  updatedAt: string;
};
type MunicipalityView = {
  id: string;
  regionId: string;
  code: string;
  name: string;
  establishments: number;
  total: number;
  newCases: number;
  controls: number;
  alerts: number;
  reports: string;
  associated: boolean;
};

@Component({
  selector: 'app-networks',
  imports: [FormsModule],
  templateUrl: './networks.html',
  styleUrl: './networks.css',
})
export class Networks {
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  private readonly api = inject(TerritorialApiService);
  private readonly analyticsApi = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly operationalPeriod = inject(OperationalPeriodService);
  protected activeTab: NetworkTab = 'summary';
  protected selectedNetworkId = '';
  protected municipalityFilter = 'Todos los municipios';
  protected selectedRegionId = '';
  protected selectedMetric: NetworkMetric = 'total';
  protected loading = false;
  protected loadError = '';
  protected regions: RegionRecord[] = [];
  protected networks: NetworkView[] = [];
  protected municipalities: MunicipalityView[] = [];
  protected membershipReason = '';
  protected membershipEffectiveDate = hondurasTodayIso();
  protected draftMembershipIds: string[] = [];
  protected showStatusForm = false;
  protected statusReason = '';
  protected nextStatus = 'SUSPENDIDO';
  protected readonly tabs: { id: NetworkTab; label: string }[] = [
    { id: 'summary', label: 'Resumen' },
    { id: 'municipalities', label: 'Municipios asociados' },
    { id: 'consolidated', label: 'Consolidado' },
    { id: 'history', label: 'Historial' },
  ];
  protected history: TerritorialAuditEventRecord[] = [];
  protected historyLoading = false;
  protected historyUnavailable = false;
  private loadRequestVersion = 0;
  protected showCreateForm = false;
  protected formSubmitted = false;
  protected networkForm = this.emptyNetworkForm();
  private historyRequestVersion = 0;

  get canManage() {
    return ['superadmin', 'regional-superadmin'].includes(this.roleContext.activeRoleId());
  }
  get canReadAudit() {
    return ['superadmin', 'regional-superadmin', 'regional-admin'].includes(
      this.roleContext.activeRoleId(),
    );
  }
  get isGlobal() {
    return this.roleContext.activeRoleId() === 'superadmin';
  }
  get selectedNetwork(): NetworkView {
    return (
      this.networks.find((network) => network.id === this.selectedNetworkId) ?? {
        id: '',
        regionId: '',
        regionName: '',
        code: 'SIN REDES',
        name: 'Sin redes configuradas',
        municipalities: 0,
        reports: '—',
        total: 0,
        status: 'Sin configurar',
        rawStatus: '',
        active: false,
        configured: false,
        memberIds: [],
        updatedAt: '',
      }
    );
  }
  get activeNetworks() {
    return this.networks.filter((network) => network.active).length;
  }
  get associatedMunicipalities() {
    return this.municipalities.filter((municipality) =>
      this.selectedNetwork.memberIds.includes(municipality.id),
    );
  }
  get filteredAssociatedMunicipalities() {
    return this.associatedMunicipalities.filter(
      (row) =>
        this.municipalityFilter === 'Todos los municipios' || row.name === this.municipalityFilter,
    );
  }
  get visibleNetworks() {
    return this.selectedRegionId
      ? this.networks.filter((network) => network.regionId === this.selectedRegionId)
      : this.networks;
  }
  get availableMunicipalities() {
    return this.municipalities.filter(
      (municipality) => municipality.regionId === this.networkForm.regionId,
    );
  }
  get selectedNetworkTotal() {
    return this.filteredAssociatedMunicipalities.reduce((total, row) => total + row.total, 0);
  }
  get selectedNetworkNewCases() {
    return this.filteredAssociatedMunicipalities.reduce((total, row) => total + row.newCases, 0);
  }
  get selectedNetworkControls() {
    return this.filteredAssociatedMunicipalities.reduce((total, row) => total + row.controls, 0);
  }
  get selectedNetworkReports() {
    return this.filteredAssociatedMunicipalities.filter((row) => row.reports === 'Recibido').length;
  }
  get selectedNetworkAlerts() {
    return this.filteredAssociatedMunicipalities.reduce((total, row) => total + row.alerts, 0);
  }
  get metricLabel() {
    return (
      {
        total: 'Atenciones',
        newCases: 'Casos nuevos',
        controls: 'Controles',
        reports: 'Reportes recibidos',
      } as Record<NetworkMetric, string>
    )[this.selectedMetric];
  }
  get maxMetricValue() {
    return Math.max(
      1,
      ...this.filteredAssociatedMunicipalities.map((row) => this.metricValue(row)),
    );
  }

  constructor() {
    effect(() => {
      const periodKey = this.operationalPeriod.selectedEndKey();
      if (periodKey) this.load();
    });
  }

  protected get periodYear() {
    return this.operationalPeriod.selected()?.year ?? 0;
  }
  protected get periodMonth() {
    return this.operationalPeriod.selected()?.month ?? 0;
  }
  protected get periodLabel() {
    return this.periodYear && this.periodMonth
      ? formatHondurasMonth(this.periodYear, this.periodMonth)
      : '—';
  }
  protected openCreate() {
    this.formSubmitted = false;
    this.networkForm = this.emptyNetworkForm();
    this.showCreateForm = true;
  }
  protected closeCreate() {
    this.showCreateForm = false;
  }
  protected saveNetwork() {
    this.formSubmitted = true;
    const form = this.networkForm;
    if (!form.name.trim() || !form.code.trim() || !form.regionId || form.reason.trim().length < 10)
      return;
    this.loading = true;
    this.api
      .createNetwork({
        regionId: form.regionId,
        code: form.code,
        name: form.name,
        operationalStatus: form.status,
        startDate: form.startDate,
        municipalityIds: form.municipalityIds,
        reason: form.reason,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (record) => {
          const view = this.toView(record);
          this.networks = [...this.networks, view];
          this.selectNetwork(view.id);
          this.showCreateForm = false;
          this.notify.emit(`Red “${view.name}” creada correctamente.`);
        },
        error: () =>
          this.notify.emit(
            'No fue posible crear la red. Verifique código, región, municipios y permisos.',
          ),
      });
  }
  protected toggleMunicipality(id: string, checked: boolean) {
    this.networkForm.municipalityIds = checked
      ? [...this.networkForm.municipalityIds, id]
      : this.networkForm.municipalityIds.filter((item) => item !== id);
  }
  protected toggleDraftMembership(id: string, checked: boolean) {
    this.draftMembershipIds = checked
      ? [...this.draftMembershipIds, id]
      : this.draftMembershipIds.filter((item) => item !== id);
  }
  protected saveMemberships() {
    const network = this.selectedNetwork;
    if (!network.id || this.membershipReason.trim().length < 10) return;
    this.loading = true;
    this.api
      .replaceNetworkMunicipalities(
        network.id,
        this.draftMembershipIds,
        this.membershipEffectiveDate,
        network.updatedAt,
        this.membershipReason,
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (record) => {
          const view = this.toView(record);
          this.networks = this.networks.map((item) => (item.id === view.id ? view : item));
          this.selectNetwork(view.id);
          this.membershipReason = '';
          this.notify.emit('Composición municipal actualizada con vigencia e historial.');
        },
        error: () =>
          this.notify.emit(
            'No fue posible cambiar la composición. Recargue y verifique la vigencia.',
          ),
      });
  }
  protected openStatus() {
    const network = this.selectedNetwork;
    if (!network.id) return;
    this.nextStatus =
      (
        {
          PRECONFIGURADO: 'CREADO',
          CREADO: 'EN_PILOTAJE',
          EN_PILOTAJE: 'ACTIVO',
          ACTIVO: 'SUSPENDIDO',
          SUSPENDIDO: 'ACTIVO',
          INACTIVO: 'ACTIVO',
        } as Record<string, string>
      )[network.rawStatus] ?? 'ACTIVO';
    this.statusReason = '';
    this.showStatusForm = true;
  }
  protected saveStatus() {
    const network = this.selectedNetwork;
    if (!network.id || this.statusReason.trim().length < 10) return;
    this.loading = true;
    this.api
      .updateNetworkStatus(network.id, this.nextStatus, network.updatedAt, this.statusReason)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (record) => {
          const view = this.toView(record);
          this.networks = this.networks.map((item) => (item.id === view.id ? view : item));
          this.selectNetwork(view.id);
          this.showStatusForm = false;
          this.notify.emit(`Red “${view.name}” actualizada a ${view.status}.`);
        },
        error: () =>
          this.notify.emit(
            'No fue posible cambiar el estado. Recargue la red y verifique la región padre.',
          ),
      });
  }
  private emptyNetworkForm() {
    return {
      name: '',
      code: '',
      regionId: this.regions?.[0]?.id ?? '',
      status: 'PRECONFIGURADO',
      startDate: hondurasTodayIso(),
      municipalityIds: [] as string[],
      reason: '',
    };
  }
  private load() {
    const requestVersion = ++this.loadRequestVersion;
    this.loading = true;
    this.loadError = '';
    forkJoin({
      regions: this.api.listRegions(),
      catalog: this.api.listCatalog(),
      networks: this.api.listNetworks(),
      analytics: this.analyticsApi.getTerritorialAnalytics(
        'MUNICIPIO',
        this.periodYear,
        this.periodMonth,
      ),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.loadRequestVersion) this.loading = false;
        }),
      )
      .subscribe({
        next: ({ regions, catalog, networks, analytics }) => {
          if (requestVersion !== this.loadRequestVersion) return;
          this.regions = regions;
          const metrics = new Map(analytics.rows.map((row) => [row.id, row]));
          this.municipalities = catalog.municipalities.map((row) => {
            const metric = metrics.get(row.id);
            return {
              id: row.id,
              regionId: row.regionId,
              code: row.officialCode,
              name: row.name,
              establishments: row.facilityCount,
              total: metric?.attentions ?? 0,
              newCases: metric?.newCases ?? 0,
              controls: metric?.controls ?? 0,
              alerts: metric?.alerts ?? 0,
              reports: metric?.reportId ? 'Recibido' : 'Pendiente',
              associated: false,
            };
          });
          this.networks = networks.map((record) => this.toView(record));
          this.networkForm.regionId = regions[0]?.id ?? '';
          if (this.networks[0]) this.selectNetwork(this.networks[0].id);
        },
        error: () => {
          if (requestVersion !== this.loadRequestVersion) return;
          this.loadError = 'No se pudo cargar el catálogo real de redes.';
          this.notify.emit(this.loadError);
        },
      });
  }
  protected retryLoad() {
    this.load();
  }
  private toView(record: HealthNetworkRecord): NetworkView {
    return {
      id: record.id,
      regionId: record.regionId,
      regionName: record.regionName,
      code: record.code,
      name: record.name,
      municipalities: record.municipalities.length,
      reports: '—',
      total: 0,
      status: this.statusLabel(record.operationalStatus),
      rawStatus: record.operationalStatus,
      active: record.active,
      configured: true,
      memberIds: record.municipalities.map((item) => item.id),
      updatedAt: record.updatedAt,
    };
  }
  private statusLabel(status: string) {
    return (
      (
        {
          PRECONFIGURADO: 'Preconfigurada',
          CREADO: 'Creada',
          EN_PILOTAJE: 'En pilotaje',
          ACTIVO: 'Activa',
          INACTIVO: 'Inactiva',
          SUSPENDIDO: 'Suspendida',
        } as Record<string, string>
      )[status] ?? status
    );
  }
  protected metricValue(row: MunicipalityView) {
    return this.selectedMetric === 'reports'
      ? row.reports === 'Recibido'
        ? 1
        : 0
      : row[this.selectedMetric];
  }
  protected metricWidth(row: MunicipalityView) {
    return `${Math.round((this.metricValue(row) / this.maxMetricValue) * 100)}%`;
  }
  protected actionLabel(action: string) {
    return (
      (
        {
          HEALTH_NETWORK_CREATED: 'Red creada',
          HEALTH_NETWORK_MEMBERSHIPS_CHANGED: 'Composición municipal actualizada',
          HEALTH_NETWORK_STATUS_CHANGED: 'Estado operativo actualizado',
        } as Record<string, string>
      )[action] ?? action.replaceAll('_', ' ')
    );
  }
  protected formatAuditDate(value: string) {
    return formatHondurasDateTime(value);
  }
  selectNetwork(id: string) {
    this.selectedNetworkId = id;
    this.activeTab = 'summary';
    this.municipalityFilter = 'Todos los municipios';
    this.draftMembershipIds = [...this.selectedNetwork.memberIds];
    this.municipalities = this.municipalities.map((row) => ({
      ...row,
      associated: this.draftMembershipIds.includes(row.id),
    }));
    this.loadHistory();
  }
  setNetwork(event: Event) {
    this.selectNetwork((event.target as HTMLSelectElement).value);
  }
  setMunicipality(event: Event) {
    this.municipalityFilter = (event.target as HTMLSelectElement).value;
  }
  setMetric(event: Event) {
    this.selectedMetric = (event.target as HTMLSelectElement).value as NetworkMetric;
  }
  setRegion(event: Event) {
    this.selectedRegionId = (event.target as HTMLSelectElement).value;
    const first = this.visibleNetworks[0];
    if (first) this.selectNetwork(first.id);
    else this.selectedNetworkId = '';
  }
  selectTab(tab: NetworkTab) {
    this.activeTab = tab;
  }
  private loadHistory() {
    const networkId = this.selectedNetworkId;
    const requestVersion = ++this.historyRequestVersion;
    this.history = [];
    this.historyLoading = false;
    this.historyUnavailable = !this.canReadAudit;
    if (!networkId || !this.canReadAudit) return;
    this.historyLoading = true;
    this.api
      .listNetworkAudit(networkId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.historyRequestVersion) this.historyLoading = false;
        }),
      )
      .subscribe({
        next: (page) => {
          if (requestVersion === this.historyRequestVersion) this.history = page.items;
        },
        error: () => {
          if (requestVersion === this.historyRequestVersion) this.historyUnavailable = true;
        },
      });
  }
}
