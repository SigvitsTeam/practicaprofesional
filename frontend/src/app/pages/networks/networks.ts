import { Component, DestroyRef, OnInit, inject, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { RoleContext } from '../../core/role-context';
import { HealthNetworkRecord, RegionRecord, TerritorialApiService } from '../../core/territorial-api.service';

type NetworkTab = 'summary' | 'municipalities' | 'consolidated' | 'history';
type NetworkView = { id: string; regionId: string; regionName: string; code: string; name: string; municipalities: number; reports: string; total: number; status: string; rawStatus: string; active: boolean; configured: boolean; memberIds: string[]; updatedAt: string };

@Component({ selector: 'app-networks', imports: [FormsModule], templateUrl: './networks.html', styleUrl: './networks.css' })
export class Networks implements OnInit {
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  private readonly api = inject(TerritorialApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected activeTab: NetworkTab = 'summary';
  protected selectedNetworkId = '';
  protected municipalityFilter = 'Todos los municipios';
  protected loading = false;
  protected regions: RegionRecord[] = [];
  protected networks: NetworkView[] = [];
  protected municipalities: { id: string; regionId: string; code: string; name: string; establishments: number; total: number; newCases: number; controls: number; reports: string; associated: boolean }[] = [];
  protected membershipReason = '';
  protected membershipEffectiveDate = new Date().toISOString().slice(0, 10);
  protected draftMembershipIds: string[] = [];
  protected showStatusForm = false;
  protected statusReason = '';
  protected nextStatus = 'SUSPENDIDO';
  protected readonly tabs: { id: NetworkTab; label: string }[] = [
    { id: 'summary', label: 'Resumen' }, { id: 'municipalities', label: 'Municipios asociados' },
    { id: 'consolidated', label: 'Consolidado' }, { id: 'history', label: 'Historial' },
  ];
  protected readonly history = [{ date: 'Pendiente de API', action: 'Historial administrativo', user: 'Sistema', detail: 'La bitácora consultable se conectará en el bloque de auditoría.' }];
  protected showCreateForm = false;
  protected formSubmitted = false;
  protected networkForm = this.emptyNetworkForm();

  get canManage() { return ['superadmin', 'regional-superadmin'].includes(this.roleContext.activeRoleId()); }
  get isGlobal() { return this.roleContext.activeRoleId() === 'superadmin'; }
  get selectedNetwork(): NetworkView { return this.networks.find(network => network.id === this.selectedNetworkId) ?? { id: '', regionId: '', regionName: '', code: 'SIN REDES', name: 'Sin redes configuradas', municipalities: 0, reports: '—', total: 0, status: 'Sin configurar', rawStatus: '', active: false, configured: false, memberIds: [], updatedAt: '' }; }
  get activeNetworks() { return this.networks.filter(network => network.active).length; }
  get associatedMunicipalities() { return this.municipalities.filter(municipality => this.selectedNetwork.memberIds.includes(municipality.id)); }
  get availableMunicipalities() { return this.municipalities.filter(municipality => municipality.regionId === this.networkForm.regionId); }

  ngOnInit() { this.load(); }
  protected openCreate() { this.formSubmitted = false; this.networkForm = this.emptyNetworkForm(); this.showCreateForm = true; }
  protected closeCreate() { this.showCreateForm = false; }
  protected saveNetwork() {
    this.formSubmitted = true; const form = this.networkForm;
    if (!form.name.trim() || !form.code.trim() || !form.regionId || form.reason.trim().length < 10) return;
    this.loading = true;
    this.api.createNetwork({ regionId: form.regionId, code: form.code, name: form.name, operationalStatus: form.status, startDate: form.startDate, municipalityIds: form.municipalityIds, reason: form.reason }).pipe(finalize(() => this.loading = false)).subscribe({
      next: record => { const view = this.toView(record); this.networks = [...this.networks, view]; this.selectNetwork(view.id); this.showCreateForm = false; this.notify.emit(`Red “${view.name}” creada correctamente.`); },
      error: () => this.notify.emit('No fue posible crear la red. Verifique código, región, municipios y permisos.'),
    });
  }
  protected toggleMunicipality(id: string, checked: boolean) { this.networkForm.municipalityIds = checked ? [...this.networkForm.municipalityIds, id] : this.networkForm.municipalityIds.filter(item => item !== id); }
  protected toggleDraftMembership(id: string, checked: boolean) { this.draftMembershipIds = checked ? [...this.draftMembershipIds, id] : this.draftMembershipIds.filter(item => item !== id); }
  protected saveMemberships() {
    const network = this.selectedNetwork;
    if (!network.id || this.membershipReason.trim().length < 10) return;
    this.loading = true;
    this.api.replaceNetworkMunicipalities(network.id, this.draftMembershipIds, this.membershipEffectiveDate, network.updatedAt, this.membershipReason).pipe(finalize(() => this.loading = false)).subscribe({
      next: record => { const view = this.toView(record); this.networks = this.networks.map(item => item.id === view.id ? view : item); this.selectNetwork(view.id); this.membershipReason = ''; this.notify.emit('Composición municipal actualizada con vigencia e historial.'); },
      error: () => this.notify.emit('No fue posible cambiar la composición. Recargue y verifique la vigencia.'),
    });
  }
  protected openStatus() {
    const network = this.selectedNetwork;
    if (!network.id) return;
    this.nextStatus = ({ PRECONFIGURADO: 'CREADO', CREADO: 'EN_PILOTAJE', EN_PILOTAJE: 'ACTIVO', ACTIVO: 'SUSPENDIDO', SUSPENDIDO: 'ACTIVO', INACTIVO: 'ACTIVO' } as Record<string, string>)[network.rawStatus] ?? 'ACTIVO';
    this.statusReason = '';
    this.showStatusForm = true;
  }
  protected saveStatus() {
    const network = this.selectedNetwork;
    if (!network.id || this.statusReason.trim().length < 10) return;
    this.loading = true;
    this.api.updateNetworkStatus(network.id, this.nextStatus, network.updatedAt, this.statusReason).pipe(finalize(() => this.loading = false)).subscribe({
      next: record => { const view = this.toView(record); this.networks = this.networks.map(item => item.id === view.id ? view : item); this.selectNetwork(view.id); this.showStatusForm = false; this.notify.emit(`Red “${view.name}” actualizada a ${view.status}.`); },
      error: () => this.notify.emit('No fue posible cambiar el estado. Recargue la red y verifique la región padre.'),
    });
  }
  private emptyNetworkForm() { return { name: '', code: '', regionId: this.regions?.[0]?.id ?? '', status: 'PRECONFIGURADO', startDate: new Date().toISOString().slice(0, 10), municipalityIds: [] as string[], reason: '' }; }
  private load() {
    this.loading = true;
    forkJoin({ regions: this.api.listRegions(), catalog: this.api.listCatalog(), networks: this.api.listNetworks() }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false)).subscribe({
      next: ({ regions, catalog, networks }) => {
        this.regions = regions;
        this.municipalities = catalog.municipalities.map(row => ({ id: row.id, regionId: row.regionId, code: row.officialCode, name: row.name, establishments: row.facilityCount, total: 0, newCases: 0, controls: 0, reports: '—', associated: false }));
        this.networks = networks.map(record => this.toView(record));
        this.networkForm.regionId = regions[0]?.id ?? '';
        if (this.networks[0]) this.selectNetwork(this.networks[0].id);
      }, error: () => this.notify.emit('No se pudo cargar el catálogo real de redes.'),
    });
  }
  private toView(record: HealthNetworkRecord): NetworkView { return { id: record.id, regionId: record.regionId, regionName: record.regionName, code: record.code, name: record.name, municipalities: record.municipalities.length, reports: '—', total: 0, status: this.statusLabel(record.operationalStatus), rawStatus: record.operationalStatus, active: record.active, configured: true, memberIds: record.municipalities.map(item => item.id), updatedAt: record.updatedAt }; }
  private statusLabel(status: string) { return ({ PRECONFIGURADO: 'Preconfigurada', CREADO: 'Creada', EN_PILOTAJE: 'En pilotaje', ACTIVO: 'Activa', INACTIVO: 'Inactiva', SUSPENDIDO: 'Suspendida' } as Record<string, string>)[status] ?? status; }
  selectNetwork(id: string) { this.selectedNetworkId = id; this.activeTab = 'summary'; this.draftMembershipIds = [...this.selectedNetwork.memberIds]; this.municipalities = this.municipalities.map(row => ({ ...row, associated: this.draftMembershipIds.includes(row.id) })); }
  setNetwork(event: Event) { this.selectNetwork((event.target as HTMLSelectElement).value); }
  setMunicipality(event: Event) { this.municipalityFilter = (event.target as HTMLSelectElement).value; }
  selectTab(tab: NetworkTab) { this.activeTab = tab; }
}
