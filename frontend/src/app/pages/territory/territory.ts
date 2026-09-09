import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoleContext } from '../../core/role-context';
import {
  formatHondurasDate,
  formatHondurasDateTime,
  hondurasTodayIso,
} from '../../core/honduras-date';
import {
  TerritorialApiService,
  type TerritorialAuditEventRecord,
} from '../../core/territorial-api.service';
import {
  ManagedUserRecord,
  UserAdminApiService,
  type InvitationVerificationRecord,
} from '../../core/user-admin-api.service';
import {
  USER_SCOPE_LABELS,
  USER_TARGET_LABELS,
  userRoleOptions,
  userScopeOptions,
} from './user-access-policy';

type TerritoryTab = 'general' | 'geography' | 'responsibles' | 'history';
type CreateTerritoryKind = 'region' | 'municipality' | 'establishment';
type AdminSection = 'overview' | 'territories' | 'facilities' | 'users';

@Component({
  selector: 'app-territory',
  imports: [FormsModule],
  templateUrl: './territory.html',
  styleUrl: './territory.css',
})
export class Territory implements OnInit {
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  private readonly api = inject(TerritorialApiService);
  private readonly userApi = inject(UserAdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  protected loading = false;
  protected activeTab: TerritoryTab = 'general';
  protected readonly tabs: { id: TerritoryTab; label: string }[] = [
    { id: 'general', label: 'Información general' },
    { id: 'geography', label: 'Geografía' },
    { id: 'responsibles', label: 'Responsables' },
    { id: 'history', label: 'Historial' },
  ];
  protected regions: {
    id: string;
    code: string;
    name: string;
    municipalities: number;
    activeMunicipalities: number;
    establishments: number;
    status: string;
    rawStatus: string;
    active: boolean;
    updatedAt: string;
  }[] = [];
  protected municipalities: {
    id: string;
    regionId: string;
    code: string;
    name: string;
    region: string;
    establishments: number;
    responsible: string;
    status: string;
    rawStatus: string;
    mapValidated: boolean;
    active: boolean;
    updatedAt: string;
  }[] = [];
  protected facilities: {
    id: string;
    municipalityId: string;
    municipality: string;
    code: string;
    name: string;
    type: string;
    status: string;
    rawStatus: string;
    coordinatesValidated: boolean;
    active: boolean;
    updatedAt: string;
  }[] = [];
  protected activeAdminSection: AdminSection = 'overview';
  protected readonly adminSectionOptions: {
    id: AdminSection;
    label: string;
    description: string;
  }[] = [
    { id: 'overview', label: 'Resumen', description: 'Estado general y accesos rápidos' },
    { id: 'territories', label: 'Territorios', description: 'Regiones y municipios' },
    { id: 'facilities', label: 'Establecimientos', description: 'Catálogo de establecimientos' },
    { id: 'users', label: 'Usuarios', description: 'Perfiles y accesos' },
  ];
  protected selectedMunicipalityId = '';
  protected regionSearch = '';
  protected municipalitySearch = '';
  protected facilitySearch = '';
  protected regionStatusFilter = 'ALL';
  protected municipalityStatusFilter = 'ALL';
  protected facilityStatusFilter = 'ALL';
  protected facilityTypeFilter = 'ALL';
  protected regionSort = 'name';
  protected municipalitySort = 'name';
  protected facilitySort = 'name';
  protected regionPage = 1;
  protected municipalityPage = 1;
  protected facilityPage = 1;
  protected readonly catalogPageSize = 8;
  protected readonly catalogSortOptions = [
    { value: 'name', label: 'Nombre' },
    { value: 'code', label: 'Código' },
    { value: 'status', label: 'Estado' },
    { value: 'updatedAt', label: 'Última actualización' },
  ];
  protected readonly statusFilterOptions = [
    { value: 'ALL', label: 'Todos los estados' },
    { value: 'ACTIVO', label: 'Activos' },
    { value: 'PRECONFIGURADO', label: 'Preconfigurados' },
    { value: 'CREADO', label: 'Creados' },
    { value: 'EN_PILOTAJE', label: 'En pilotaje' },
    { value: 'SUSPENDIDO', label: 'Suspendidos' },
    { value: 'INACTIVO', label: 'Inactivos' },
  ];
  protected history: TerritorialAuditEventRecord[] = [];
  protected historyNextCursor: string | undefined;
  protected historyLoading = false;
  protected territoryStatusTarget: {
    entityType: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
    id: string;
    name: string;
    rawStatus: string;
    updatedAt: string;
  } | null = null;
  protected territoryNextStatus = 'SUSPENDIDO';
  protected territoryStatusReason = '';
  protected territoryStatusSubmitted = false;
  protected users: ManagedUserRecord[] = [];
  protected userSearch = '';
  protected userStatusFilter = 'ALL';
  protected userRoleFilter = 'ALL';
  protected userScopeFilter = 'ALL';
  protected userPage = 1;
  protected readonly userPageSize = 8;
  protected showUserForm = false;
  protected editingUser: ManagedUserRecord | null = null;
  protected statusUser: ManagedUserRecord | null = null;
  protected statusReason = '';
  protected statusSubmitted = false;
  protected identityUser: ManagedUserRecord | null = null;
  protected identitySubmitted = false;
  protected invitationUser: ManagedUserRecord | null = null;
  protected invitationSubmitted = false;
  protected readonly invitationError = signal('');
  protected readonly invitationStatuses = signal<Record<string, InvitationVerificationRecord>>({});
  protected readonly invitationStatusErrors = signal<Record<string, string>>({});
  protected readonly checkingInvitationId = signal('');
  protected resendingInvitation = false;
  protected invitationForm = { activate: true, reason: '' };
  protected identityForm = { externalSubject: '', activate: true, reason: '' };
  protected userFormSubmitted = false;
  protected userForm = this.emptyUserForm();
  get regionalScope() {
    return this.roleContext.activeRoleId() === 'regional-superadmin';
  }
  get globalScope() {
    return this.roleContext.activeRoleId() === 'superadmin';
  }
  get selectedMunicipality() {
    return (
      this.municipalities.find((row) => row.id === this.selectedMunicipalityId) ??
      this.municipalities[0]
    );
  }
  get selectedRegion() {
    return this.regions.find((row) => row.id === this.selectedMunicipality?.regionId);
  }
  get selectedFacilities() {
    return this.facilities.filter((row) => row.municipalityId === this.selectedMunicipality?.id);
  }
  get validatedFacilityCount() {
    return this.selectedFacilities.filter((row) => row.coordinatesValidated).length;
  }
  get coordinateProgress() {
    return this.selectedFacilities.length
      ? Math.round((this.validatedFacilityCount * 100) / this.selectedFacilities.length)
      : 0;
  }
  get responsibles() {
    const municipality = this.selectedMunicipality;
    if (!municipality) return [];
    const facilityIds = new Set(this.selectedFacilities.map((row) => row.id));
    return this.users
      .filter(
        (user) =>
          user.assignment.municipalityId === municipality.id ||
          (!!user.assignment.facilityId && facilityIds.has(user.assignment.facilityId)) ||
          user.assignment.regionId === municipality.regionId,
      )
      .map((user) => ({
        id: user.id,
        initials: user.fullName
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase(),
        name: user.fullName,
        role: user.role.name,
        scope: user.assignment.label,
        status:
          user.active && user.hasExternalIdentity
            ? 'Activo'
            : user.hasExternalIdentity
              ? 'Suspendido'
              : 'Pendiente de identidad',
        since: this.formatDate(user.assignment.startDate),
      }));
  }
  get readinessProgress() {
    const checks = [
      this.selectedMunicipality?.active,
      this.selectedMunicipality?.mapValidated,
      this.selectedFacilities.length > 0,
      this.selectedFacilities.length > 0 &&
        this.validatedFacilityCount === this.selectedFacilities.length,
      this.responsibles.some((row) => row.status === 'Activo'),
    ];
    return Math.round((checks.filter(Boolean).length * 100) / checks.length);
  }
  get pendingCoordinates() {
    return this.selectedFacilities.length - this.validatedFacilityCount;
  }
  get activeRegionCount() {
    return this.regions.filter((row) => row.active).length;
  }
  get activeMunicipalityCount() {
    return this.municipalities.filter((row) => row.active).length;
  }
  get activeFacilityCount() {
    return this.facilities.filter((row) => row.active).length;
  }
  get pendingIdentityCount() {
    return this.users.filter((user) => !user.hasExternalIdentity).length;
  }

  protected get filteredUsers() {
    const query = this.normalizeSearch(this.userSearch);
    return this.users.filter((user) => {
      const matchesQuery =
        !query ||
        [user.fullName, user.email, user.role.name, user.assignment.label].some((value) =>
          this.normalizeSearch(value).includes(query),
        );
      const matchesStatus =
        this.userStatusFilter === 'ALL' ||
        this.userAccessStatusCode(user) === this.userStatusFilter;
      const matchesRole = this.userRoleFilter === 'ALL' || user.role.code === this.userRoleFilter;
      const matchesScope =
        this.userScopeFilter === 'ALL' || user.assignment.scopeType === this.userScopeFilter;
      return matchesQuery && matchesStatus && matchesRole && matchesScope;
    });
  }

  protected get userTotalPages() {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.userPageSize));
  }

  protected get visibleUsers() {
    const start = (this.userPage - 1) * this.userPageSize;
    return this.filteredUsers.slice(start, start + this.userPageSize);
  }

  protected get userPageStart() {
    return this.filteredUsers.length ? (this.userPage - 1) * this.userPageSize + 1 : 0;
  }

  protected get userPageEnd() {
    return Math.min(this.userPage * this.userPageSize, this.filteredUsers.length);
  }

  protected get userRoleFilterOptions() {
    const roles = new Map<string, string>();
    this.users.forEach((user) => roles.set(user.role.code, user.role.name));
    return [...roles.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }

  protected get userScopeFilterOptions() {
    return Object.entries(USER_SCOPE_LABELS);
  }

  protected get userPageNumbers() {
    const total = this.userTotalPages;
    const windowSize = Math.min(total, 5);
    const first = Math.max(1, Math.min(this.userPage - 2, total - windowSize + 1));
    return Array.from({ length: windowSize }, (_, index) => first + index);
  }

  protected get userHasFilters() {
    return !!(
      this.userSearch.trim() ||
      this.userStatusFilter !== 'ALL' ||
      this.userRoleFilter !== 'ALL' ||
      this.userScopeFilter !== 'ALL'
    );
  }

  protected filterUsers() {
    this.userPage = 1;
  }

  protected clearUserFilters() {
    this.userSearch = '';
    this.userStatusFilter = 'ALL';
    this.userRoleFilter = 'ALL';
    this.userScopeFilter = 'ALL';
    this.userPage = 1;
  }

  protected goToUserPage(page: number) {
    this.userPage = Math.min(Math.max(page, 1), this.userTotalPages);
  }

  protected userAccessStatusCode(user: ManagedUserRecord) {
    return user.active && user.hasExternalIdentity
      ? 'ACTIVE'
      : user.hasExternalIdentity
        ? 'SUSPENDED'
        : 'PENDING';
  }
  get filteredRegions() {
    const query = this.normalizeSearch(this.regionSearch);
    return this.sortCatalogRows(
      this.regions.filter(
        (row) =>
          (!query || this.matchesSearch(query, row.name, row.code, row.status)) &&
          (this.regionStatusFilter === 'ALL' || row.rawStatus === this.regionStatusFilter),
      ),
      this.regionSort,
    );
  }
  get filteredMunicipalities() {
    const query = this.normalizeSearch(this.municipalitySearch);
    return this.sortCatalogRows(
      this.municipalities.filter(
        (row) =>
          (!query ||
            this.matchesSearch(
              query,
              row.name,
              row.code,
              row.region,
              row.responsible,
              row.status,
            )) &&
          (this.municipalityStatusFilter === 'ALL' ||
            row.rawStatus === this.municipalityStatusFilter),
      ),
      this.municipalitySort,
    );
  }
  get filteredFacilities() {
    const query = this.normalizeSearch(this.facilitySearch);
    return this.sortCatalogRows(
      this.facilities.filter(
        (row) =>
          (!query ||
            this.matchesSearch(
              query,
              row.name,
              row.code,
              row.municipality,
              row.type,
              row.status,
            )) &&
          (this.facilityStatusFilter === 'ALL' || row.rawStatus === this.facilityStatusFilter) &&
          (this.facilityTypeFilter === 'ALL' || row.type === this.facilityTypeFilter),
      ),
      this.facilitySort,
    );
  }

  protected get regionTotalPages() {
    return this.catalogTotalPages(this.filteredRegions.length);
  }

  protected get municipalityTotalPages() {
    return this.catalogTotalPages(this.filteredMunicipalities.length);
  }

  protected get facilityTotalPages() {
    return this.catalogTotalPages(this.filteredFacilities.length);
  }

  protected get visibleRegions() {
    return this.catalogPage(this.filteredRegions, this.regionPage);
  }

  protected get visibleMunicipalities() {
    return this.catalogPage(this.filteredMunicipalities, this.municipalityPage);
  }

  protected get visibleFacilities() {
    return this.catalogPage(this.filteredFacilities, this.facilityPage);
  }

  protected get regionPageStart() {
    return this.catalogPageStart(this.regionPage, this.filteredRegions.length);
  }

  protected get municipalityPageStart() {
    return this.catalogPageStart(this.municipalityPage, this.filteredMunicipalities.length);
  }

  protected get facilityPageStart() {
    return this.catalogPageStart(this.facilityPage, this.filteredFacilities.length);
  }

  protected get regionPageEnd() {
    return this.catalogPageEnd(this.regionPage, this.filteredRegions.length);
  }

  protected get municipalityPageEnd() {
    return this.catalogPageEnd(this.municipalityPage, this.filteredMunicipalities.length);
  }

  protected get facilityPageEnd() {
    return this.catalogPageEnd(this.facilityPage, this.filteredFacilities.length);
  }

  protected get regionPageNumbers() {
    return this.catalogPageNumbers(this.regionPage, this.regionTotalPages);
  }

  protected get municipalityPageNumbers() {
    return this.catalogPageNumbers(this.municipalityPage, this.municipalityTotalPages);
  }

  protected get facilityPageNumbers() {
    return this.catalogPageNumbers(this.facilityPage, this.facilityTotalPages);
  }

  protected resetRegionPage() {
    this.regionPage = 1;
  }

  protected resetMunicipalityPage() {
    this.municipalityPage = 1;
  }

  protected resetFacilityPage() {
    this.facilityPage = 1;
  }

  protected goToRegionPage(page: number) {
    this.regionPage = this.clampCatalogPage(page, this.regionTotalPages);
  }

  protected goToMunicipalityPage(page: number) {
    this.municipalityPage = this.clampCatalogPage(page, this.municipalityTotalPages);
  }

  protected goToFacilityPage(page: number) {
    this.facilityPage = this.clampCatalogPage(page, this.facilityTotalPages);
  }

  protected get facilityTypeOptions() {
    return [...new Set(this.facilities.map((facility) => facility.type))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  protected get territoryHasFilters() {
    return Boolean(
      this.regionSearch.trim() ||
      this.regionStatusFilter !== 'ALL' ||
      this.municipalitySearch.trim() ||
      this.municipalityStatusFilter !== 'ALL',
    );
  }

  protected get facilityHasFilters() {
    return Boolean(
      this.facilitySearch.trim() ||
      this.facilityStatusFilter !== 'ALL' ||
      this.facilityTypeFilter !== 'ALL',
    );
  }

  protected setAdminSection(section: AdminSection) {
    this.activeAdminSection = section;
  }

  protected adminSectionCount(section: AdminSection) {
    switch (section) {
      case 'territories':
        return this.regions.length + this.municipalities.length;
      case 'facilities':
        return this.facilities.length;
      case 'users':
        return this.users.length;
      default:
        return null;
    }
  }

  protected clearTerritoryFilters() {
    this.regionSearch = '';
    this.regionStatusFilter = 'ALL';
    this.municipalitySearch = '';
    this.municipalityStatusFilter = 'ALL';
    this.resetRegionPage();
    this.resetMunicipalityPage();
  }

  protected clearFacilityFilters() {
    this.facilitySearch = '';
    this.facilityStatusFilter = 'ALL';
    this.facilityTypeFilter = 'ALL';
    this.resetFacilityPage();
  }

  private sortCatalogRows<
    T extends { name: string; code: string; status: string; updatedAt: string },
  >(rows: T[], sortBy: string) {
    const key =
      sortBy === 'code' || sortBy === 'status' || sortBy === 'updatedAt' ? sortBy : 'name';
    return [...rows].sort((a, b) =>
      String(a[key as keyof T]).localeCompare(String(b[key as keyof T]), 'es', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }

  private catalogTotalPages(total: number) {
    return Math.max(1, Math.ceil(total / this.catalogPageSize));
  }

  private catalogPage<T>(rows: T[], page: number) {
    const start = (page - 1) * this.catalogPageSize;
    return rows.slice(start, start + this.catalogPageSize);
  }

  private catalogPageStart(page: number, total: number) {
    return total ? (page - 1) * this.catalogPageSize + 1 : 0;
  }

  private catalogPageEnd(page: number, total: number) {
    return Math.min(page * this.catalogPageSize, total);
  }

  private catalogPageNumbers(page: number, total: number) {
    const windowSize = Math.min(total, 5);
    const first = Math.max(1, Math.min(page - 2, total - windowSize + 1));
    return Array.from({ length: windowSize }, (_, index) => first + index);
  }

  private clampCatalogPage(page: number, total: number) {
    return Math.min(Math.max(page, 1), total);
  }

  protected createKind: CreateTerritoryKind | null = null;
  protected formSubmitted = false;
  protected territoryForm = this.emptyForm();

  ngOnInit() {
    this.loadCatalog();
  }

  protected get createTitle() {
    return this.createKind === 'region'
      ? 'Nueva región sanitaria'
      : this.createKind === 'municipality'
        ? 'Nuevo municipio'
        : 'Nuevo establecimiento';
  }

  openCreate(kind: CreateTerritoryKind) {
    if (kind === 'region' && !this.globalScope) return;
    this.activeAdminSection = kind === 'establishment' ? 'facilities' : 'territories';
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
    this.api
      .listMunicipalityAudit(municipalityId, append ? this.historyNextCursor : undefined)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.historyLoading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: (page) => {
          this.history = append ? [...this.history, ...page.items] : page.items;
          this.historyNextCursor = page.nextCursor;
        },
        error: () => {
          this.history = [];
          this.historyNextCursor = undefined;
        },
      });
  }

  protected auditActionLabel(action: string) {
    return (
      (
        {
          MUNICIPALITY_CREATED: 'Municipio creado',
          TERRITORIAL_STATUS_CHANGED: 'Estado territorial actualizado',
        } as Record<string, string>
      )[action] ?? action.replaceAll('_', ' ')
    );
  }

  protected closeCreate() {
    this.createKind = null;
    this.formSubmitted = false;
  }

  protected closeUserForm() {
    this.showUserForm = false;
    this.editingUser = null;
    this.userFormSubmitted = false;
  }

  protected closeStatus() {
    this.statusUser = null;
    this.statusSubmitted = false;
  }

  protected closeIdentity() {
    this.identityUser = null;
    this.identitySubmitted = false;
  }

  protected closeInvitation() {
    this.invitationUser = null;
    this.resendingInvitation = false;
    this.invitationSubmitted = false;
  }

  protected closeTerritoryStatus() {
    this.territoryStatusTarget = null;
    this.territoryStatusSubmitted = false;
  }

  protected saveTerritory() {
    this.formSubmitted = true;
    const form = this.territoryForm;
    const missingParent =
      (this.createKind === 'municipality' && !form.regionId) ||
      (this.createKind === 'establishment' && (!form.municipalityId || !form.type));
    if (!form.name.trim() || !form.code.trim() || form.reason.trim().length < 10 || missingParent)
      return;
    this.loading = true;
    if (this.createKind === 'region') {
      this.api
        .createRegion({ code: form.code, name: form.name, type: 'SANITARIA', reason: form.reason })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: () => this.saved('Región', form.name),
          error: () =>
            this.notify.emit(
              'No fue posible crear la región. Verifique permisos, código y datos ingresados.',
            ),
        });
    } else if (this.createKind === 'municipality') {
      this.api
        .createMunicipality({
          regionId: form.regionId,
          officialCode: form.code,
          name: form.name,
          reason: form.reason,
        })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: () => this.saved('Municipio', form.name),
          error: () =>
            this.notify.emit(
              'No fue posible crear el municipio. Verifique alcance, código y datos ingresados.',
            ),
        });
    } else if (this.createKind === 'establishment') {
      this.api
        .createFacility({
          municipalityId: form.municipalityId,
          code: form.code,
          name: form.name,
          type: form.type,
          address: form.address || undefined,
          reason: form.reason,
        })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: () => this.saved('Establecimiento', form.name),
          error: () =>
            this.notify.emit(
              'No fue posible crear el establecimiento. Verifique alcance, código y datos ingresados.',
            ),
        });
    } else {
      this.loading = false;
    }
  }

  protected openUserCreate() {
    this.activeAdminSection = 'users';
    this.editingUser = null;
    this.userFormSubmitted = false;
    this.userForm = this.emptyUserForm();
    this.showUserForm = true;
  }
  protected openUserEdit(user: ManagedUserRecord) {
    this.activeAdminSection = 'users';
    this.editingUser = user;
    this.userFormSubmitted = false;
    this.userForm = {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? '',
      roleCode: user.role.code,
      scopeType: user.assignment.scopeType,
      targetId: this.assignmentTargetId(user),
      startDate: hondurasTodayIso(),
      reason: '',
    };
    this.showUserForm = true;
  }

  protected saveUser() {
    if (this.loading) return;
    this.userFormSubmitted = true;
    const form = this.userForm;
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      form.reason.trim().length < 10 ||
      !this.userRoleValid ||
      !this.userScopeValid ||
      !this.userStartDateValid ||
      !this.userAccessValid
    )
      return;
    const target =
      form.scopeType === 'NACIONAL'
        ? {}
        : form.scopeType === 'REGION'
          ? { regionId: form.targetId }
          : form.scopeType === 'MUNICIPIO'
            ? { municipalityId: form.targetId }
            : { facilityId: form.targetId };
    this.loading = true;
    const operation = this.editingUser
      ? this.userApi.changeAccess(this.editingUser.id, {
          roleCode: form.roleCode,
          scopeType: form.scopeType,
          ...target,
          startDate: form.startDate,
          expectedUpdatedAt: this.editingUser.updatedAt,
          reason: form.reason,
        })
      : this.userApi.create({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          roleCode: form.roleCode,
          scopeType: form.scopeType,
          ...target,
          startDate: form.startDate,
          reason: form.reason,
        });
    operation
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (user) => {
          const wasEditing = !!this.editingUser;
          this.users = [...this.users.filter((item) => item.id !== user.id), user].sort((a, b) =>
            a.fullName.localeCompare(b.fullName),
          );
          this.closeUserForm();
          this.notify.emit(
            wasEditing
              ? `Acceso de “${user.fullName}” actualizado con historial.`
              : `Perfil de “${user.fullName}” creado pendiente de vincular su identidad.`,
          );
        },
        error: () =>
          this.notify.emit(
            'No fue posible guardar el usuario. Verifique versión, jerarquía y alcance territorial.',
          ),
      });
  }

  protected openStatus(user: ManagedUserRecord) {
    this.activeAdminSection = 'users';
    this.statusUser = user;
    this.statusReason = '';
    this.statusSubmitted = false;
  }
  protected openIdentityLink(user: ManagedUserRecord) {
    this.activeAdminSection = 'users';
    this.identityUser = user;
    this.identityForm = { externalSubject: '', activate: true, reason: '' };
    this.identitySubmitted = false;
  }
  protected openInvitation(user: ManagedUserRecord) {
    this.activeAdminSection = 'users';
    this.invitationError.set('');
    this.resendingInvitation = false;
    this.invitationUser = user;
    this.invitationForm = { activate: true, reason: '' };
    this.invitationSubmitted = false;
  }
  protected openInvitationResend(user: ManagedUserRecord) {
    if (this.invitationStatuses()[user.id]?.status !== 'PENDING') return;
    this.activeAdminSection = 'users';
    this.invitationError.set('');
    this.resendingInvitation = true;
    this.invitationUser = user;
    this.invitationForm = { activate: user.active, reason: '' };
    this.invitationSubmitted = false;
  }
  protected checkInvitationStatus(user: ManagedUserRecord) {
    if (!user.hasExternalIdentity || this.checkingInvitationId()) return;
    this.checkingInvitationId.set(user.id);
    this.clearInvitationStatus(user.id);
    this.invitationStatusErrors.update((errors) => ({ ...errors, [user.id]: '' }));
    this.userApi
      .getInvitationStatus(user.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.checkingInvitationId.set('')),
      )
      .subscribe({
        next: (status) => {
          this.updateInvitationProfileVersion(user.id, status.profileUpdatedAt);
          this.invitationStatuses.update((statuses) => ({
            ...statuses,
            [user.id]: status,
          }));
        },
        error: (error) =>
          this.invitationStatusErrors.update((errors) => ({
            ...errors,
            [user.id]:
              error.error?.message ?? 'No fue posible consultar la confirmación en Supabase.',
          })),
      });
  }
  protected sendInvitation() {
    this.invitationSubmitted = true;
    const user = this.invitationUser;
    if (
      !user ||
      this.loading ||
      this.invitationForm.reason.trim().length < 10 ||
      (this.resendingInvitation && this.invitationStatuses()[user.id]?.status !== 'PENDING')
    )
      return;
    this.invitationError.set('');
    this.loading = true;
    if (this.resendingInvitation) {
      this.userApi
        .resendInvitation(user.id, {
          expectedUpdatedAt: user.updatedAt,
          reason: this.invitationForm.reason,
        })
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => (this.loading = false)),
        )
        .subscribe({
          next: (status) => {
            this.updateInvitationProfileVersion(user.id, status.profileUpdatedAt);
            this.clearInvitationStatus(user.id);
            this.closeInvitation();
            this.notify.emit(
              `Supabase aceptó el reenvío para “${user.email}”. Verifica el estado antes de solicitar otro correo.`,
            );
          },
          error: (error) => {
            this.clearInvitationStatus(user.id);
            this.invitationError.set(
              `${error.error?.message ?? 'No fue posible confirmar el resultado del reenvío.'} Cierre este diálogo y consulte de nuevo el estado antes de intentar otro correo.`,
            );
          },
        });
      return;
    }
    this.userApi
      .invite(user.id, {
        activate: this.invitationForm.activate,
        expectedUpdatedAt: user.updatedAt,
        reason: this.invitationForm.reason,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (updated) => {
          this.users = this.users.map((item) => (item.id === updated.id ? updated : item));
          this.clearInvitationStatus(updated.id);
          this.closeInvitation();
          this.notify.emit(
            `Supabase aceptó la invitación para “${updated.email}”. El destinatario debe abrir el correo y establecer su contraseña.`,
          );
        },
        error: (error) =>
          this.invitationError.set(
            error.error?.message ?? 'No fue posible enviar la invitación institucional.',
          ),
      });
  }
  protected saveIdentityLink() {
    this.identitySubmitted = true;
    const user = this.identityUser;
    if (
      !user ||
      !this.identityForm.externalSubject.trim() ||
      this.identityForm.reason.trim().length < 10
    )
      return;
    this.loading = true;
    this.userApi
      .linkExternalIdentity(user.id, {
        externalSubject: this.identityForm.externalSubject,
        activate: this.identityForm.activate,
        expectedUpdatedAt: user.updatedAt,
        reason: this.identityForm.reason,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (updated) => {
          this.users = this.users.map((item) => (item.id === updated.id ? updated : item));
          this.closeIdentity();
          this.notify.emit(
            `Identidad externa vinculada a “${updated.fullName}”${updated.active ? ' y acceso activado' : ''}.`,
          );
        },
        error: () =>
          this.notify.emit(
            'No fue posible vincular la identidad. Verifique el identificador externo, la versión y que no esté asignado a otro perfil.',
          ),
      });
  }
  protected saveStatus() {
    this.statusSubmitted = true;
    const user = this.statusUser;
    if (!user || this.statusReason.trim().length < 10) return;
    this.loading = true;
    this.userApi
      .updateStatus(user.id, !user.active, user.updatedAt, this.statusReason)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (updated) => {
          this.users = this.users.map((item) => (item.id === updated.id ? updated : item));
          this.closeStatus();
          this.notify.emit(
            `Usuario “${updated.fullName}” ${updated.active ? 'reactivado' : 'suspendido'} correctamente.`,
          );
        },
        error: () =>
          this.notify.emit(
            'No fue posible cambiar el estado. Recargue el catálogo y verifique las reglas de seguridad.',
          ),
      });
  }

  protected openTerritoryStatus(
    target: { id: string; name: string; rawStatus: string; updatedAt: string },
    entityType: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO',
  ) {
    this.activeAdminSection = entityType === 'ESTABLECIMIENTO' ? 'facilities' : 'territories';
    this.territoryStatusTarget = { ...target, entityType };
    this.territoryNextStatus =
      (
        {
          PRECONFIGURADO: 'CREADO',
          CREADO: 'EN_PILOTAJE',
          EN_PILOTAJE: 'ACTIVO',
          ACTIVO: 'SUSPENDIDO',
          SUSPENDIDO: 'ACTIVO',
          INACTIVO: 'ACTIVO',
        } as Record<string, string>
      )[target.rawStatus] ?? 'ACTIVO';
    this.territoryStatusReason = '';
    this.territoryStatusSubmitted = false;
  }

  protected saveTerritoryStatus() {
    this.territoryStatusSubmitted = true;
    const target = this.territoryStatusTarget;
    if (!target || this.territoryStatusReason.trim().length < 10) return;
    this.loading = true;
    this.api
      .updateTerritorialStatus(
        target.entityType,
        target.id,
        this.territoryNextStatus,
        target.updatedAt,
        this.territoryStatusReason,
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (updated) => {
          this.closeTerritoryStatus();
          this.notify.emit(
            `Estado territorial actualizado a ${this.statusLabel(updated.operationalStatus)}.`,
          );
          this.loadCatalog();
        },
        error: () =>
          this.notify.emit(
            'No fue posible cambiar el estado. Verifique dependencias activas y recargue el catálogo.',
          ),
      });
  }

  private emptyForm() {
    return {
      name: '',
      code: '',
      regionId: this.regions?.[0]?.id ?? '',
      municipalityId: this.municipalities?.[0]?.id ?? '',
      type: 'CIS',
      responsible: '',
      status: 'Preconfigurado',
      address: '',
      reason: '',
    };
  }

  private emptyUserForm() {
    return {
      fullName: '',
      email: '',
      phone: '',
      roleCode: 'ADMIN_REGIONAL',
      scopeType: 'REGION',
      targetId: '',
      startDate: hondurasTodayIso(),
      reason: '',
    };
  }
  protected readonly userScopeLabels = USER_SCOPE_LABELS;
  protected get assignableUserRoles() {
    return userRoleOptions(this.globalScope);
  }
  protected get allowedUserScopes() {
    return userScopeOptions(this.userForm.roleCode, this.globalScope);
  }
  protected get userTargetLabel() {
    const scope = this.allowedUserScopes.find((scope) => scope === this.userForm.scopeType);
    return scope ? USER_TARGET_LABELS[scope] : 'Territorio';
  }
  protected get userRoleValid() {
    return this.assignableUserRoles.some((role) => role.code === this.userForm.roleCode);
  }
  protected get userScopeValid() {
    return this.allowedUserScopes.some((scope) => scope === this.userForm.scopeType);
  }
  protected get userStartDateValid() {
    return !!this.userForm.startDate;
  }
  protected get userAccessValid() {
    if (!this.userScopeValid) return false;
    return (
      this.userForm.scopeType === 'NACIONAL' ||
      this.userTargets().some((target) => target.id === this.userForm.targetId)
    );
  }
  protected userTargets() {
    if (this.userForm.scopeType === 'REGION')
      return this.regions
        .filter((row) => row.active)
        .map((row) => ({ id: row.id, name: row.name }));
    if (this.userForm.scopeType === 'MUNICIPIO')
      return this.municipalities
        .filter((row) => row.active)
        .map((row) => ({ id: row.id, name: `${row.name} — ${row.region}` }));
    if (this.userForm.scopeType === 'ESTABLECIMIENTO')
      return this.facilities
        .filter((row) => row.active)
        .map((row) => ({ id: row.id, name: `${row.code} · ${row.name} — ${row.municipality}` }));
    return [];
  }
  protected scopeChanged(scope: string) {
    this.userForm.scopeType = this.allowedUserScopes.find((allowed) => allowed === scope) ?? '';
    this.userForm.targetId = '';
  }
  protected roleChanged(role: string) {
    this.userForm.roleCode = role;
    const scopes = this.allowedUserScopes;
    this.scopeChanged(scopes.find((scope) => scope === this.userForm.scopeType) ?? scopes[0] ?? '');
  }

  private assignmentTargetId(user: ManagedUserRecord): string {
    switch (user.assignment.scopeType) {
      case 'REGION':
        return user.assignment.regionId ?? '';
      case 'MUNICIPIO':
        return user.assignment.municipalityId ?? '';
      case 'ESTABLECIMIENTO':
        return user.assignment.facilityId ?? '';
      default:
        return '';
    }
  }

  private saved(label: string, name: string) {
    this.closeCreate();
    this.notify.emit(`${label} “${name.trim()}” creado correctamente.`);
    this.loadCatalog();
  }

  private loadCatalog() {
    this.loading = true;
    forkJoin({
      regions: this.api.listRegions(),
      catalog: this.api.listCatalog(),
      users: this.userApi.list(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
          this.changeDetector.markForCheck();
        }),
      )
      .subscribe({
        next: ({ regions, catalog, users }) => {
          this.municipalities = catalog.municipalities.map((row) => ({
            id: row.id,
            regionId: row.regionId,
            code: row.officialCode,
            name: row.name,
            region: row.regionName,
            establishments: row.facilityCount,
            responsible: 'Sin asignar',
            status: this.statusLabel(row.operationalStatus),
            rawStatus: row.operationalStatus,
            mapValidated: row.mapValidated,
            active: row.active,
            updatedAt: row.updatedAt,
          }));
          this.facilities = catalog.facilities.map((row) => ({
            id: row.id,
            municipalityId: row.municipalityId,
            municipality:
              this.municipalities.find((municipality) => municipality.id === row.municipalityId)
                ?.name ?? 'Municipio no disponible',
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
          this.userPage = Math.min(this.userPage, this.userTotalPages);
          this.municipalities = this.municipalities.map((municipality) => ({
            ...municipality,
            responsible:
              users.find(
                (user) => user.assignment.municipalityId === municipality.id && user.active,
              )?.fullName ?? 'Sin asignar',
          }));
          this.regions = regions.map((region) => {
            const municipalities = this.municipalities.filter((row) => row.regionId === region.id);
            return {
              id: region.id,
              code: region.code,
              name: region.name,
              municipalities: municipalities.length,
              activeMunicipalities: municipalities.filter((row) => row.active).length,
              establishments: municipalities.reduce((total, row) => total + row.establishments, 0),
              status: this.statusLabel(region.operationalStatus),
              rawStatus: region.operationalStatus,
              active: region.active,
              updatedAt: region.updatedAt,
            };
          });
          this.regionPage = this.clampCatalogPage(this.regionPage, this.regionTotalPages);
          this.municipalityPage = this.clampCatalogPage(
            this.municipalityPage,
            this.municipalityTotalPages,
          );
          this.facilityPage = this.clampCatalogPage(this.facilityPage, this.facilityTotalPages);
          this.territoryForm.regionId ||= this.regions[0]?.id ?? '';
          this.territoryForm.municipalityId ||= this.municipalities[0]?.id ?? '';
          if (!this.municipalities.some((row) => row.id === this.selectedMunicipalityId))
            this.selectedMunicipalityId = this.municipalities[0]?.id ?? '';
          this.loadHistory(false);
        },
        error: () => this.notify.emit('No se pudo cargar el catálogo territorial real.'),
      });
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

  private normalizeSearch(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim();
  }

  private matchesSearch(query: string, ...values: string[]) {
    return values.some((value) => this.normalizeSearch(value).includes(query));
  }

  protected formatDate(value: string) {
    return formatHondurasDate(value);
  }

  protected formatDateTime(value: string) {
    return formatHondurasDateTime(value);
  }

  private clearInvitationStatus(userId: string) {
    this.invitationStatuses.update((statuses) => {
      const next = { ...statuses };
      delete next[userId];
      return next;
    });
  }

  private updateInvitationProfileVersion(userId: string, profileUpdatedAt?: string) {
    if (!profileUpdatedAt) return;
    this.users = this.users.map((user) =>
      user.id === userId ? { ...user, updatedAt: profileUpdatedAt } : user,
    );
    if (this.invitationUser?.id === userId)
      this.invitationUser = { ...this.invitationUser, updatedAt: profileUpdatedAt };
  }

  selectTab(tab: TerritoryTab) {
    this.activeTab = tab;
  }
}
