import { ChangeDetectorRef, Component, DestroyRef, effect, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
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
  scopeLimited?: boolean;
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
  private readonly changeDetector = inject(ChangeDetectorRef);
  private currentNetworks: HealthNetworkRecord[] = [];
  protected activeTab: NetworkTab = 'summary';
  protected selectedNetworkId = '';
  protected municipalityFilter = 'Todos los municipios';
  protected selectedRegionId = '';
  protected selectedMetric: NetworkMetric = 'total';
  private fetching = false;
  private saving = false;
  protected get loading() {
    return this.fetching || this.saving;
  }
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
    return this.filteredAssociatedMunicipalities.filter(
      (row) => row.reports === 'Consolidado disponible',
    ).length;
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
        reports: 'Consolidados disponibles',
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
  protected get compositionDate() {
    return this.periodYear && this.periodMonth
      ? new Date(Date.UTC(this.periodYear, this.periodMonth, 0)).toISOString().slice(0, 10)
      : '';
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
    if (!this.canManage || this.loading) return;
    this.formSubmitted = true;
    const form = this.networkForm;
    if (!form.name.trim() || !form.code.trim() || !form.regionId || form.reason.trim().length < 10)
      return;
    this.saving = true;
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
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (record) => {
          this.showCreateForm = false;
          this.notify.emit(`Red “${record.name}” creada correctamente.`);
          this.load();
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
    const network = this.currentNetworks.find(({ id }) => id === this.selectedNetworkId);
    if (!this.canManage || this.loading || !network || this.membershipReason.trim().length < 10)
      return;
    this.saving = true;
    this.api
      .replaceNetworkMunicipalities(
        network.id,
        this.draftMembershipIds,
        this.membershipEffectiveDate,
        network.updatedAt,
        this.membershipReason,
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.membershipReason = '';
          this.notify.emit('Composición municipal actualizada con vigencia e historial.');
          this.load();
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
    if (!this.canManage || this.loading) return;
    const network = this.selectedNetwork;
    if (!network.id || this.statusReason.trim().length < 10) return;
    this.saving = true;
    this.api
      .updateNetworkStatus(network.id, this.nextStatus, network.updatedAt, this.statusReason)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (record) => {
          this.showStatusForm = false;
          this.notify.emit(
            `Red “${record.name}” actualizada a ${this.statusLabel(record.operationalStatus)}.`,
          );
          this.load();
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
    this.fetching = true;
    this.loadError = '';
    this.networks = [];
    this.municipalities = [];
    this.currentNetworks = [];
    forkJoin({
      regions: this.api.listRegions(),
      catalog: this.api.listCatalog(),
      networks: this.api.listNetworks(this.compositionDate),
      currentNetworks: this.canManage ? this.api.listNetworks() : of([] as HealthNetworkRecord[]),
      analytics: this.analyticsApi.getTerritorialAnalytics(
        'MUNICIPIO',
        this.periodYear,
        this.periodMonth,
      ),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (requestVersion === this.loadRequestVersion) this.fetching = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: ({ regions, catalog, networks, currentNetworks, analytics }) => {
          if (requestVersion !== this.loadRequestVersion) return;
          this.regions = regions;
          this.currentNetworks = currentNetworks;
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
              reports: metric?.reportId ? 'Consolidado disponible' : 'Sin consolidado',
              associated: false,
            };
          });
          this.networks = networks.map((record) => this.toView(record));
          this.networkForm.regionId = regions[0]?.id ?? '';
          const selected =
            this.visibleNetworks.find(({ id }) => id === this.selectedNetworkId) ??
            this.visibleNetworks[0];
          this.selectNetwork(selected?.id ?? '');
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
      scopeLimited: record.scopeLimited,
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
      ? row.reports === 'Consolidado disponible'
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
    this.draftMembershipIds = this.canManage
      ? (this.currentNetworks
          .find(({ id: networkId }) => networkId === id)
          ?.municipalities.map(({ id: municipalityId }) => municipalityId) ?? [])
      : [...this.selectedNetwork.memberIds];
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
  protected onTabKeydown(event: KeyboardEvent, tab: NetworkTab) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = this.tabs.findIndex((item) => item.id === tab);
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % this.tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index + this.tabs.length - 1) % this.tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = this.tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = this.tabs[nextIndex];
    this.selectTab(nextTab.id);
    const tablist = (event.currentTarget as HTMLButtonElement).parentElement;
    tablist?.querySelector<HTMLButtonElement>(`#network-tab-${nextTab.id}`)?.focus();
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
          this.changeDetector.markForCheck();
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
