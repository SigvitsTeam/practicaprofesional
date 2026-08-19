import { Component, DestroyRef, OnInit, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoleContext } from '../../core/role-context';
import { TerritorialApiService } from '../../core/territorial-api.service';
import { ManagedUserRecord, UserAdminApiService } from '../../core/user-admin-api.service';

type TerritoryTab = 'general' | 'geography' | 'responsibles' | 'history';
type CreateTerritoryKind = 'region' | 'municipality' | 'establishment';

@Component({ selector: 'app-territory', imports: [FormsModule], templateUrl: './territory.html', styleUrl: './territory.css' })
export class Territory implements OnInit {
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  private readonly api = inject(TerritorialApiService);
  private readonly userApi = inject(UserAdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected loading = false;
  protected activeTab: TerritoryTab = 'general';
  protected readonly tabs: { id: TerritoryTab; label: string }[] = [
    { id: 'general', label: 'Información general' },
    { id: 'geography', label: 'Geografía' },
    { id: 'responsibles', label: 'Responsables' },
    { id: 'history', label: 'Historial' },
  ];
  protected readonly responsibles = [
    { initials: 'AM', name: 'Dra. Ana Martínez', role: 'Coordinadora Municipal', scope: 'Puerto Cortés', status: 'Activo', since: '12 ene 2026' },
    { initials: 'ML', name: 'María López', role: 'Digitadora de Coordinación', scope: '12 establecimientos', status: 'Activo', since: '03 feb 2026' },
    { initials: 'RL', name: 'Lic. Roberto Lagos', role: 'SuperAdmin Regional', scope: 'Región de Cortés', status: 'Supervisión', since: '08 ene 2026' },
  ];
  protected readonly history = [
    { date: '04 ago 2026 · 09:22', user: 'Lic. Roberto Lagos', action: 'Actualizó catálogo de establecimientos', detail: 'Se registraron los 12 establecimientos oficiales de Puerto Cortés.', tone: 'green' },
    { date: '03 ago 2026 · 15:40', user: 'Dra. Ana Martínez', action: 'Validó información municipal', detail: 'Confirmó el código 0506 y la dependencia regional.', tone: 'blue' },
    { date: '02 ago 2026 · 11:18', user: 'Carlos Mejía', action: 'Activó coordinación en pilotaje', detail: 'Puerto Cortés quedó disponible para operación supervisada.', tone: 'purple' },
    { date: '01 ago 2026 · 08:05', user: 'Sistema', action: 'Registró geometría municipal', detail: 'La silueta geográfica se vinculó al catálogo territorial.', tone: 'gray' },
  ];
  protected regions: { id: string; code: string; name: string; municipalities: number; activeMunicipalities: number; establishments: number; status: string; rawStatus: string; active: boolean; updatedAt: string }[] = [];
  protected municipalities: { id: string; regionId: string; code: string; name: string; region: string; establishments: number; responsible: string; status: string; rawStatus: string; active: boolean; updatedAt: string }[] = [];
  protected establishmentNames: string[] = [];
  protected facilities: { id: string; municipalityId: string; municipality: string; code: string; name: string; type: string; status: string; rawStatus: string; active: boolean; updatedAt: string }[] = [];
  protected territoryStatusTarget: { entityType: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO'; id: string; name: string; rawStatus: string; updatedAt: string } | null = null;
  protected territoryNextStatus = 'SUSPENDIDO';
  protected territoryStatusReason = '';
  protected users: ManagedUserRecord[] = [];
  protected showUserForm = false;
  protected editingUser: ManagedUserRecord | null = null;
  protected statusUser: ManagedUserRecord | null = null;
  protected statusReason = '';
  protected userFormSubmitted = false;
  protected userForm = this.emptyUserForm();
  get regionalScope() { return this.roleContext.activeRoleId() === 'regional-superadmin'; }
  get globalScope() { return this.roleContext.activeRoleId() === 'superadmin'; }
  get selectedMunicipality() { return this.municipalities.find(row => row.code === '0506') ?? this.municipalities[0]; }

  protected createKind: CreateTerritoryKind | null = null;
  protected formSubmitted = false;
  protected territoryForm = this.emptyForm();

  ngOnInit() { this.loadCatalog(); }

  protected get createTitle() {
    return this.createKind === 'region' ? 'Nueva región sanitaria' : this.createKind === 'municipality' ? 'Nuevo municipio' : 'Nuevo establecimiento';
  }

  openCreate(kind: CreateTerritoryKind) {
    if (kind === 'region' && !this.globalScope) return;
    this.createKind = kind;
    this.formSubmitted = false;
    this.territoryForm = this.emptyForm();
    if (kind === 'region') this.territoryForm.status = 'Preconfigurada';
  }

  protected closeCreate() {
    this.createKind = null;
    this.formSubmitted = false;
  }

  protected saveTerritory() {
    this.formSubmitted = true;
    const form = this.territoryForm;
    if (!form.name.trim() || !form.code.trim() || form.reason.trim().length < 10) return;
    this.loading = true;
    if (this.createKind === 'region') {
      this.api.createRegion({ code: form.code, name: form.name, type: 'SANITARIA', reason: form.reason }).pipe(finalize(() => this.loading = false)).subscribe({
        next: () => this.saved('Región', form.name), error: () => this.notify.emit('No fue posible crear la región. Verifique permisos, código y datos ingresados.'),
      });
    } else if (this.createKind === 'municipality') {
      this.api.createMunicipality({ regionId: form.regionId, officialCode: form.code, name: form.name, reason: form.reason }).pipe(finalize(() => this.loading = false)).subscribe({
        next: () => this.saved('Municipio', form.name), error: () => this.notify.emit('No fue posible crear el municipio. Verifique alcance, código y datos ingresados.'),
      });
    } else if (this.createKind === 'establishment') {
      this.api.createFacility({ municipalityId: form.municipalityId, code: form.code, name: form.name, type: form.type, address: form.address || undefined, reason: form.reason }).pipe(finalize(() => this.loading = false)).subscribe({
        next: () => this.saved('Establecimiento', form.name), error: () => this.notify.emit('No fue posible crear el establecimiento. Verifique alcance, código y datos ingresados.'),
      });
    } else {
      this.loading = false;
    }
  }

  protected openUserCreate() { this.editingUser = null; this.userFormSubmitted = false; this.userForm = this.emptyUserForm(); this.showUserForm = true; }
  protected openUserEdit(user: ManagedUserRecord) {
    this.editingUser = user; this.userFormSubmitted = false;
    this.userForm = { fullName: user.fullName, email: user.email, phone: user.phone ?? '', roleCode: user.role.code, scopeType: user.assignment.scopeType, targetId: user.assignment.regionId ?? user.assignment.municipalityId ?? user.assignment.facilityId ?? '', startDate: new Date().toISOString().slice(0, 10), reason: '' };
    this.showUserForm = true;
  }

  protected saveUser() {
    this.userFormSubmitted = true;
    const form = this.userForm;
    if (!form.fullName.trim() || !form.email.trim() || form.reason.trim().length < 10 || !form.targetId) return;
    const target = form.scopeType === 'NACIONAL' ? {} : form.scopeType === 'REGION' ? { regionId: form.targetId } : form.scopeType === 'MUNICIPIO' ? { municipalityId: form.targetId } : { facilityId: form.targetId };
    this.loading = true;
    const operation = this.editingUser
      ? this.userApi.changeAccess(this.editingUser.id, { roleCode: form.roleCode, scopeType: form.scopeType, ...target, startDate: form.startDate, expectedUpdatedAt: this.editingUser.updatedAt, reason: form.reason })
      : this.userApi.create({ fullName: form.fullName, email: form.email, phone: form.phone || undefined, roleCode: form.roleCode, scopeType: form.scopeType, ...target, startDate: form.startDate, reason: form.reason });
    operation.pipe(finalize(() => this.loading = false)).subscribe({
      next: user => { this.users = [...this.users.filter(item => item.id !== user.id), user].sort((a, b) => a.fullName.localeCompare(b.fullName)); this.showUserForm = false; this.notify.emit(this.editingUser ? `Acceso de “${user.fullName}” actualizado con historial.` : `Perfil de “${user.fullName}” creado pendiente de vincular su identidad.`); this.editingUser = null; },
      error: () => this.notify.emit('No fue posible guardar el usuario. Verifique versión, jerarquía y alcance territorial.'),
    });
  }

  protected openStatus(user: ManagedUserRecord) { this.statusUser = user; this.statusReason = ''; }
  protected saveStatus() {
    const user = this.statusUser;
    if (!user || this.statusReason.trim().length < 10) return;
    this.loading = true;
    this.userApi.updateStatus(user.id, !user.active, user.updatedAt, this.statusReason).pipe(finalize(() => this.loading = false)).subscribe({
      next: updated => { this.users = this.users.map(item => item.id === updated.id ? updated : item); this.statusUser = null; this.notify.emit(`Usuario “${updated.fullName}” ${updated.active ? 'reactivado' : 'suspendido'} correctamente.`); },
      error: () => this.notify.emit('No fue posible cambiar el estado. Recargue el catálogo y verifique las reglas de seguridad.'),
    });
  }

  protected openTerritoryStatus(target: { id: string; name: string; rawStatus: string; updatedAt: string }, entityType: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO') {
    this.territoryStatusTarget = { ...target, entityType };
    this.territoryNextStatus = ({ PRECONFIGURADO: 'CREADO', CREADO: 'EN_PILOTAJE', EN_PILOTAJE: 'ACTIVO', ACTIVO: 'SUSPENDIDO', SUSPENDIDO: 'ACTIVO', INACTIVO: 'ACTIVO' } as Record<string, string>)[target.rawStatus] ?? 'ACTIVO';
    this.territoryStatusReason = '';
  }

  protected saveTerritoryStatus() {
    const target = this.territoryStatusTarget;
    if (!target || this.territoryStatusReason.trim().length < 10) return;
    this.loading = true;
    this.api.updateTerritorialStatus(target.entityType, target.id, this.territoryNextStatus, target.updatedAt, this.territoryStatusReason).pipe(finalize(() => this.loading = false)).subscribe({
      next: updated => { this.territoryStatusTarget = null; this.notify.emit(`Estado territorial actualizado a ${this.statusLabel(updated.operationalStatus)}.`); this.loadCatalog(); },
      error: () => this.notify.emit('No fue posible cambiar el estado. Verifique dependencias activas y recargue el catálogo.'),
    });
  }

  private emptyForm() {
    return { name: '', code: '', regionId: this.regions?.[0]?.id ?? '', municipalityId: this.municipalities?.[0]?.id ?? '', type: 'CIS', responsible: '', status: 'Preconfigurado', address: '', reason: '' };
  }

  private emptyUserForm() { return { fullName: '', email: '', phone: '', roleCode: 'ADMIN_REGIONAL', scopeType: 'REGION', targetId: this.regions?.[0]?.id ?? '', startDate: new Date().toISOString().slice(0, 10), reason: '' }; }
  protected userTargets() {
    if (this.userForm.scopeType === 'NACIONAL') return [{ id: 'NATIONAL', name: 'Honduras' }];
    if (this.userForm.scopeType === 'REGION') return this.regions.map(row => ({ id: row.id, name: row.name }));
    if (this.userForm.scopeType === 'MUNICIPIO') return this.municipalities.map(row => ({ id: row.id, name: row.name }));
    return this.facilities.map(row => ({ id: row.id, name: row.name }));
  }
  protected scopeChanged() { this.userForm.targetId = this.userTargets()[0]?.id ?? ''; }
  protected roleChanged() {
    const role = this.userForm.roleCode;
    this.userForm.scopeType = role === 'ADMIN_CENTRAL' ? 'NACIONAL' : ['SUPERADMIN_REGIONAL', 'ADMIN_REGIONAL'].includes(role) ? 'REGION' : role === 'COORDINADOR_MUNICIPAL' ? 'MUNICIPIO' : ['DIGITADOR_COORDINACION', 'RESPONSABLE_ESTABLECIMIENTO'].includes(role) ? 'ESTABLECIMIENTO' : this.userForm.scopeType;
    this.scopeChanged();
  }

  private saved(label: string, name: string) {
    this.closeCreate();
    this.notify.emit(`${label} “${name.trim()}” creado correctamente.`);
    this.loadCatalog();
  }

  private loadCatalog() {
    this.loading = true;
    forkJoin({ regions: this.api.listRegions(), catalog: this.api.listCatalog(), users: this.userApi.list() }).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.loading = false),
    ).subscribe({
      next: ({ regions, catalog, users }) => {
        this.municipalities = catalog.municipalities.map(row => ({ id: row.id, regionId: row.regionId, code: row.officialCode, name: row.name, region: row.regionName, establishments: row.facilityCount, responsible: 'Sin asignar', status: this.statusLabel(row.operationalStatus), rawStatus: row.operationalStatus, active: row.active, updatedAt: row.updatedAt }));
        this.facilities = catalog.facilities.map(row => ({
          id: row.id,
          municipalityId: row.municipalityId,
          municipality: this.municipalities.find(municipality => municipality.id === row.municipalityId)?.name ?? 'Municipio no disponible',
          code: row.code,
          name: row.name,
          type: row.type,
          status: this.statusLabel(row.operationalStatus),
          rawStatus: row.operationalStatus,
          active: row.active,
          updatedAt: row.updatedAt,
        }));
        this.establishmentNames = this.facilities.map(row => row.name);
        this.users = users;
        this.regions = regions.map(region => {
          const municipalities = this.municipalities.filter(row => row.regionId === region.id);
          return { id: region.id, code: region.code, name: region.name, municipalities: municipalities.length, activeMunicipalities: municipalities.filter(row => row.active).length, establishments: municipalities.reduce((total, row) => total + row.establishments, 0), status: this.statusLabel(region.operationalStatus), rawStatus: region.operationalStatus, active: region.active, updatedAt: region.updatedAt };
        });
        this.territoryForm.regionId ||= this.regions[0]?.id ?? '';
        this.territoryForm.municipalityId ||= this.municipalities[0]?.id ?? '';
        this.userForm.targetId ||= this.userTargets()[0]?.id ?? '';
      },
      error: () => this.notify.emit('No se pudo cargar el catálogo territorial real.'),
    });
  }

  private statusLabel(status: string) {
    return ({ PRECONFIGURADO: 'Preconfigurada', CREADO: 'Creada', EN_PILOTAJE: 'En pilotaje', ACTIVO: 'Activa', INACTIVO: 'Inactiva', SUSPENDIDO: 'Suspendida' } as Record<string, string>)[status] ?? status;
  }

  selectTab(tab: TerritoryTab) { this.activeTab = tab; }
}
