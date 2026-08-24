import { Component, DestroyRef, OnInit, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoleContext } from '../../core/role-context';
import { TerritorialApiService, type TerritorialAuditEventRecord } from '../../core/territorial-api.service';
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
  protected regions: { id: string; code: string; name: string; municipalities: number; activeMunicipalities: number; establishments: number; status: string; rawStatus: string; active: boolean; updatedAt: string }[] = [];
  protected municipalities: { id: string; regionId: string; code: string; name: string; region: string; establishments: number; responsible: string; status: string; rawStatus: string; mapValidated: boolean; active: boolean; updatedAt: string }[] = [];
  protected facilities: { id: string; municipalityId: string; municipality: string; code: string; name: string; type: string; status: string; rawStatus: string; coordinatesValidated: boolean; active: boolean; updatedAt: string }[] = [];
  protected selectedMunicipalityId = '';
  protected history: TerritorialAuditEventRecord[] = [];
  protected historyNextCursor: string | undefined;
  protected historyLoading = false;
  protected territoryStatusTarget: { entityType: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO'; id: string; name: string; rawStatus: string; updatedAt: string } | null = null;
  protected territoryNextStatus = 'SUSPENDIDO';
  protected territoryStatusReason = '';
  protected users: ManagedUserRecord[] = [];
  protected showUserForm = false;
  protected editingUser: ManagedUserRecord | null = null;
  protected statusUser: ManagedUserRecord | null = null;
  protected statusReason = '';
  protected identityUser: ManagedUserRecord | null = null;
  protected invitationUser: ManagedUserRecord | null = null;
  protected invitationForm = { activate: true, reason: '' };
  protected identityForm = { externalSubject: '', activate: true, reason: '' };
  protected userFormSubmitted = false;
  protected userForm = this.emptyUserForm();
  get regionalScope() { return this.roleContext.activeRoleId() === 'regional-superadmin'; }
  get globalScope() { return this.roleContext.activeRoleId() === 'superadmin'; }
  get selectedMunicipality() { return this.municipalities.find(row => row.id === this.selectedMunicipalityId) ?? this.municipalities[0]; }
  get selectedRegion() { return this.regions.find(row => row.id === this.selectedMunicipality?.regionId); }
  get selectedFacilities() { return this.facilities.filter(row => row.municipalityId === this.selectedMunicipality?.id); }
  get validatedFacilityCount() { return this.selectedFacilities.filter(row => row.coordinatesValidated).length; }
  get coordinateProgress() { return this.selectedFacilities.length ? Math.round(this.validatedFacilityCount * 100 / this.selectedFacilities.length) : 0; }
  get responsibles() {
    const municipality = this.selectedMunicipality;
    if (!municipality) return [];
    const facilityIds = new Set(this.selectedFacilities.map(row => row.id));
    return this.users.filter(user =>
      user.assignment.municipalityId === municipality.id
      || (!!user.assignment.facilityId && facilityIds.has(user.assignment.facilityId))
      || user.assignment.regionId === municipality.regionId,
    ).map(user => ({
      id: user.id,
      initials: user.fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
      name: user.fullName,
      role: user.role.name,
      scope: user.assignment.label,
      status: user.active && user.hasExternalIdentity ? 'Activo' : user.hasExternalIdentity ? 'Suspendido' : 'Pendiente de identidad',
      since: this.formatDate(user.assignment.startDate),
    }));
  }
  get readinessProgress() {
    const checks = [this.selectedMunicipality?.active, this.selectedMunicipality?.mapValidated, this.selectedFacilities.length > 0, this.selectedFacilities.length > 0 && this.validatedFacilityCount === this.selectedFacilities.length, this.responsibles.some(row => row.status === 'Activo')];
    return Math.round(checks.filter(Boolean).length * 100 / checks.length);
  }
  get pendingCoordinates() { return this.selectedFacilities.length - this.validatedFacilityCount; }
  get activeRegionCount() { return this.regions.filter(row => row.active).length; }
  get activeMunicipalityCount() { return this.municipalities.filter(row => row.active).length; }
  get activeFacilityCount() { return this.facilities.filter(row => row.active).length; }

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

  protected selectMunicipality(id: string) {
    if (id === this.selectedMunicipalityId) return;
    this.selectedMunicipalityId = id;
    this.loadHistory(false);
  }

  protected loadHistory(append: boolean) {
    const municipalityId = this.selectedMunicipality?.id;
    if (!municipalityId || this.historyLoading) return;
    this.historyLoading = true;
    this.api.listMunicipalityAudit(municipalityId, append ? this.historyNextCursor : undefined).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.historyLoading = false),
    ).subscribe({
      next: page => {
        this.history = append ? [...this.history, ...page.items] : page.items;
        this.historyNextCursor = page.nextCursor;
      },
      error: () => { this.history = []; this.historyNextCursor = undefined; },
    });
  }

  protected auditActionLabel(action: string) {
    return ({ MUNICIPALITY_CREATED: 'Municipio creado', TERRITORIAL_STATUS_CHANGED: 'Estado territorial actualizado' } as Record<string, string>)[action] ?? action.replaceAll('_', ' ');
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
  protected openIdentityLink(user: ManagedUserRecord) {
    this.identityUser = user;
    this.identityForm = { externalSubject: '', activate: true, reason: '' };
  }
  protected openInvitation(user: ManagedUserRecord) {
    this.invitationUser = user;
    this.invitationForm = { activate: true, reason: '' };
  }
  protected sendInvitation() {
    const user = this.invitationUser;
    if (!user || this.invitationForm.reason.trim().length < 10) return;
    this.loading = true;
    this.userApi.invite(user.id, {
      activate: this.invitationForm.activate,
      expectedUpdatedAt: user.updatedAt,
      reason: this.invitationForm.reason,
    }).pipe(finalize(() => this.loading = false)).subscribe({
      next: updated => {
        this.users = this.users.map(item => item.id === updated.id ? updated : item);
        this.invitationUser = null;
        this.notify.emit(`Invitación enviada a “${updated.email}” e identidad vinculada.`);
      },
      error: error => this.notify.emit(error.error?.message ?? 'No fue posible enviar la invitación institucional.'),
    });
  }
  protected saveIdentityLink() {
    const user = this.identityUser;
    if (!user || !this.identityForm.externalSubject.trim() || this.identityForm.reason.trim().length < 10) return;
    this.loading = true;
    this.userApi.linkExternalIdentity(user.id, {
      externalSubject: this.identityForm.externalSubject,
      activate: this.identityForm.activate,
      expectedUpdatedAt: user.updatedAt,
      reason: this.identityForm.reason,
    }).pipe(finalize(() => this.loading = false)).subscribe({
      next: updated => {
        this.users = this.users.map(item => item.id === updated.id ? updated : item);
        this.identityUser = null;
        this.notify.emit(`Identidad externa vinculada a “${updated.fullName}”${updated.active ? ' y acceso activado' : ''}.`);
      },
      error: () => this.notify.emit('No fue posible vincular la identidad. Verifique el identificador externo, la versión y que no esté asignado a otro perfil.'),
    });
  }
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
        this.municipalities = catalog.municipalities.map(row => ({ id: row.id, regionId: row.regionId, code: row.officialCode, name: row.name, region: row.regionName, establishments: row.facilityCount, responsible: 'Sin asignar', status: this.statusLabel(row.operationalStatus), rawStatus: row.operationalStatus, mapValidated: row.mapValidated, active: row.active, updatedAt: row.updatedAt }));
        this.facilities = catalog.facilities.map(row => ({
          id: row.id,
          municipalityId: row.municipalityId,
          municipality: this.municipalities.find(municipality => municipality.id === row.municipalityId)?.name ?? 'Municipio no disponible',
          code: row.code,
          name: row.name,
          type: row.type,
          status: this.statusLabel(row.operationalStatus),
          rawStatus: row.operationalStatus,
          coordinatesValidated: row.coordinatesValidated,
          active: row.active,
          updatedAt: row.updatedAt,
        }));
        this.users = users;
        this.municipalities = this.municipalities.map(municipality => ({
          ...municipality,
          responsible: users.find(user => user.assignment.municipalityId === municipality.id && user.active)?.fullName ?? 'Sin asignar',
        }));
        this.regions = regions.map(region => {
          const municipalities = this.municipalities.filter(row => row.regionId === region.id);
          return { id: region.id, code: region.code, name: region.name, municipalities: municipalities.length, activeMunicipalities: municipalities.filter(row => row.active).length, establishments: municipalities.reduce((total, row) => total + row.establishments, 0), status: this.statusLabel(region.operationalStatus), rawStatus: region.operationalStatus, active: region.active, updatedAt: region.updatedAt };
        });
        this.territoryForm.regionId ||= this.regions[0]?.id ?? '';
        this.territoryForm.municipalityId ||= this.municipalities[0]?.id ?? '';
        if (!this.municipalities.some(row => row.id === this.selectedMunicipalityId)) this.selectedMunicipalityId = this.municipalities[0]?.id ?? '';
        this.loadHistory(false);
        this.userForm.targetId ||= this.userTargets()[0]?.id ?? '';
      },
      error: () => this.notify.emit('No se pudo cargar el catálogo territorial real.'),
    });
  }

  private statusLabel(status: string) {
    return ({ PRECONFIGURADO: 'Preconfigurada', CREADO: 'Creada', EN_PILOTAJE: 'En pilotaje', ACTIVO: 'Activa', INACTIVO: 'Inactiva', SUSPENDIDO: 'Suspendida' } as Record<string, string>)[status] ?? status;
  }

  protected formatDate(value: string) {
    return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  }

  selectTab(tab: TerritoryTab) { this.activeTab = tab; }
}
