import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { catchError, forkJoin, map, Subscription, throwError } from 'rxjs';
import { AuthService } from './core/auth.service';
import { SCREEN_META } from './core/mock-data';
import { Report, RoleId } from './core/models';
import { RoleContext } from './core/role-context';
import { EstablishmentContext } from './core/establishment-context';
import { GlobalFilters } from './layout/global-filters/global-filters';
import { Sidebar } from './layout/sidebar/sidebar';
import { Topbar } from './layout/topbar/topbar';
import { CaptureIts1 } from './pages/capture-its1/capture-its1';
import { Consolidated } from './pages/consolidated/consolidated';
import { Exports } from './pages/exports/exports';
import { Maps } from './pages/maps/maps';
import { Networks } from './pages/networks/networks';
import { ReportIts2 } from './pages/report-its2/report-its2';
import { ReviewInbox } from './pages/review-inbox/review-inbox';
import { RoleDashboard } from './pages/role-dashboard/role-dashboard';
import { Territory } from './pages/territory/territory';
import { Login } from './pages/login/login';
import { ReportDrawer } from './shared/report-drawer/report-drawer';
import { CurrentProfileApiService } from './core/current-profile-api.service';
import { mapInstitutionalRoleCodes } from './core/institutional-role';
import { OperationalPeriodService } from './core/operational-period';
import { EmailAccessService } from './core/email-access.service';
import { PasswordSetup } from './pages/password-setup/password-setup';
import { PeriodAdministration } from './pages/period-administration/period-administration';
import { ReviewNotificationsService } from './core/review-notifications.service';

@Component({
  selector: 'app-root',
  imports: [
    Sidebar,
    Topbar,
    GlobalFilters,
    RoleDashboard,
    CaptureIts1,
    ReportIts2,
    ReviewInbox,
    Consolidated,
    Maps,
    Networks,
    Exports,
    Territory,
    ReportDrawer,
    Login,
    PasswordSetup,
    PeriodAdministration,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None,
})
export class App {
  @ViewChild('territory') private territory?: {
    openCreate(kind: 'region' | 'municipality' | 'establishment'): void;
  };
  @ViewChild('reviewInbox') private reviewInbox?: { reload(): void };
  @ViewChild('maps') private maps?: { reload(): void };
  protected readonly roleContext = inject(RoleContext);
  protected readonly auth = inject(AuthService);
  protected readonly emailAccess = inject(EmailAccessService);
  protected readonly reviewNotifications = inject(ReviewNotificationsService);
  private readonly currentProfileApi = inject(CurrentProfileApiService);
  private readonly establishmentContext = inject(EstablishmentContext);
  private readonly operationalPeriod = inject(OperationalPeriodService);
  private readonly destroyRef = inject(DestroyRef);
  private profileSubscriptions = new Subscription();
  active = 'Inicio';
  adminSection: 'territory' | 'periods' = 'territory';
  get canManagePeriods() {
    return this.role.id === 'superadmin' || this.role.id === 'central-validator';
  }
  get showPeriodAdministration() {
    return (
      this.canManagePeriods &&
      (this.adminSection === 'periods' || this.role.id === 'central-validator')
    );
  }
  selectedReport: Report | null = null;
  notice = '';
  darkMode = false;
  readonly profileReady = signal(false);
  readonly profileError = signal('');
  private allowedRoleIds: RoleId[] = [];
  private loadingProfileUserId = '';
  private profileRequestVersion = 0;
  private loadedProfileUserId = '';
  private institutionalDisplayName = '';
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    if (this.emailAccess.active()) this.auth.signOut();
    this.destroyRef.onDestroy(() => {
      this.profileSubscriptions.unsubscribe();
      if (this.noticeTimer) clearTimeout(this.noticeTimer);
    });
    const savedTheme =
      typeof localStorage !== 'undefined' ? localStorage.getItem('sigvits-theme') : null;
    const systemPrefersDark =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
    this.darkMode = savedTheme ? savedTheme === 'dark' : systemPrefersDark;
    this.applyTheme();
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.profileSubscriptions.unsubscribe();
        this.profileRequestVersion += 1;
        this.loadingProfileUserId = '';
        this.operationalPeriod.clear();
        this.profileReady.set(false);
        this.profileError.set('');
        this.allowedRoleIds = [];
        this.loadedProfileUserId = '';
        this.institutionalDisplayName = '';
        return;
      }
      if (this.auth.isDemo()) {
        this.profileSubscriptions.unsubscribe();
        this.profileRequestVersion += 1;
        this.loadingProfileUserId = '';
        this.operationalPeriod.useDemoCatalog();
        this.allowedRoleIds = this.roleContext.roles.map((role) => role.id);
        this.loadedProfileUserId = user.id;
        this.profileReady.set(true);
        return;
      }
      if (this.loadingProfileUserId !== user.id && this.loadedProfileUserId !== user.id)
        this.loadProfile(user.id);
    });
  }

  private loadProfile(userId: string) {
    this.profileSubscriptions.unsubscribe();
    this.profileSubscriptions = new Subscription();
    const requestVersion = ++this.profileRequestVersion;
    this.loadingProfileUserId = userId;
    this.loadedProfileUserId = '';
    this.profileReady.set(false);
    this.profileError.set('');
    this.allowedRoleIds = [];
    this.institutionalDisplayName = '';
    this.operationalPeriod.clear();
    const profile = this.currentProfileApi.get().pipe(
      catchError(() =>
        throwError(
          () =>
            new Error(
              'No fue posible cargar el perfil institucional. Verifique la conexión o vuelva a iniciar sesión.',
            ),
        ),
      ),
      map((profile) => {
        const roleIds = mapInstitutionalRoleCodes(profile.roles);
        const initialRole = roleIds[0];
        if (!initialRole) throw new Error('La cuenta no tiene un rol institucional vigente.');
        return { profile, roleIds, initialRole };
      }),
    );
    const periods = this.operationalPeriod
      .fetchCatalog(true)
      .pipe(
        catchError(() =>
          throwError(
            () =>
              new Error(
                'No fue posible cargar los períodos institucionales. Verifique la configuración de base de datos.',
              ),
          ),
        ),
      );
    this.profileSubscriptions.add(
      forkJoin({ profile, periods }).subscribe({
        next: ({ profile: { profile, roleIds, initialRole }, periods }) => {
          if (requestVersion !== this.profileRequestVersion || this.auth.user()?.id !== userId)
            return;
          if (!periods.length) {
            const adminRole = roleIds.find((r) => r === 'superadmin' || r === 'central-validator');
            if (
              !adminRole ||
              !profile.territory.national ||
              !profile.permissions.some((p) => p === 'reporting:periods:manage' || p === '*')
            ) {
              this.loadingProfileUserId = '';
              this.profileError.set(
                'No existen períodos institucionales mensuales configurados para SIGVITS. Contacte al administrador.',
              );
              return;
            }
            initialRole = adminRole;
            this.active = 'Administración';
            this.adminSection = 'periods';
          }
          this.allowedRoleIds = roleIds;
          this.institutionalDisplayName = profile.displayName?.trim() ?? '';
          this.roleContext.select(initialRole);
          this.operationalPeriod.useCatalog(periods);
          this.loadedProfileUserId = userId;
          this.loadingProfileUserId = '';
          this.profileReady.set(true);
        },
        error: (error: Error) => {
          if (requestVersion !== this.profileRequestVersion || this.auth.user()?.id !== userId)
            return;
          this.loadingProfileUserId = '';
          this.profileError.set(error.message);
        },
      }),
    );
  }

  get role() {
    return this.roleContext.activeRole();
  }
  get availableRoleProfiles() {
    return this.roleContext.roles.filter((role) => this.allowedRoleIds.includes(role.id));
  }
  get authenticatedUserName() {
    if (!this.auth.isDemo() && this.institutionalDisplayName) return this.institutionalDisplayName;
    return this.auth.user()?.name ?? 'Usuario autenticado';
  }
  get authenticatedUserInitials() {
    return (
      this.authenticatedUserName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'UA'
    );
  }
  get meta() {
    if (this.active === 'Administración' && this.showPeriodAdministration)
      return {
        eyebrow: 'ADMINISTRACIÓN NACIONAL',
        title: 'Períodos mensuales',
        description: 'Calendario institucional, apertura nacional y trazabilidad.',
      };
    if (!this.auth.isDemo()) return this.productionMeta();
    if (this.active === 'Inicio') return this.role.dashboardMeta;
    if (this.active === 'Captura ITS 1' && this.role.id === 'establishment-manager') {
      return {
        eyebrow: 'ESTABLECIMIENTO · CIS LINDA COELLO',
        title: 'Captura de atención ITS 1',
        description: 'Registro individual correspondiente al establecimiento asignado.',
      };
    }
    if (this.active === 'Reporte ITS 2' && this.role.id === 'establishment-manager') {
      return {
        eyebrow: 'ESTABLECIMIENTO · CIS LINDA COELLO',
        title: 'Reporte mensual ITS 2',
        description: 'Consolidado propio para envío a la Coordinación de Puerto Cortés.',
      };
    }
    if (this.active === 'Administración' && this.role.id === 'superadmin') {
      return {
        eyebrow: 'ADMINISTRACIÓN GLOBAL · HONDURAS',
        title: 'Administración territorial',
        description: 'Gestión nacional de regiones, municipios y sus niveles dependientes.',
      };
    }
    if (this.active === 'Administración' && this.role.id === 'regional-superadmin') {
      return {
        eyebrow: 'SUPERADMIN REGIONAL · CORTÉS',
        title: 'Administración territorial de Cortés',
        description:
          'Gestión de municipios, establecimientos y usuarios dentro de la región asignada.',
      };
    }
    if (this.active === 'Redes' && this.role.id === 'superadmin') {
      return {
        eyebrow: 'ADMINISTRACIÓN GLOBAL · REDES',
        title: 'Gestión de Redes de salud',
        description: 'Administración de redes y municipios asociados en cualquier región.',
      };
    }
    if (this.active === 'Redes' && this.role.id === 'regional-superadmin') {
      return {
        eyebrow: 'SUPERADMIN REGIONAL · CORTÉS',
        title: 'Redes de la Región de Cortés',
        description: 'Administración, consolidación y exportación de agrupaciones municipales.',
      };
    }
    if (this.active === 'Redes') {
      return {
        eyebrow: 'ANÁLISIS AGREGADO · REDES',
        title: 'Consolidado por Redes',
        description:
          'Consulta, filtros, comparativos y exportaciones de producción municipal agregada.',
      };
    }
    if (this.active === 'Bandeja de revisión') {
      if (this.role.id === 'central-validator')
        return {
          eyebrow: 'NIVEL CENTRAL · HONDURAS',
          title: 'Revisión de regiones',
          description: 'Validación de consolidados regionales antes del cierre nacional.',
        };
      if (['regional-superadmin', 'regional-admin'].includes(this.role.id))
        return {
          eyebrow: 'REGIÓN SANITARIA · CORTÉS',
          title: 'Revisión de municipios',
          description: 'Validación de consolidados municipales antes del cierre regional.',
        };
      return {
        eyebrow: 'COORDINACIÓN MUNICIPAL · PUERTO CORTÉS',
        title: 'Revisión de establecimientos',
        description: 'Validación de reportes ITS 2 antes del consolidado municipal.',
      };
    }
    if (this.active === 'Consolidados') {
      if (this.role.id === 'central-validator')
        return {
          eyebrow: 'NIVEL CENTRAL · HONDURAS',
          title: 'Consolidado nacional',
          description: 'Cobertura regional, calidad y preparación del cierre nacional ITS.',
        };
      if (['regional-superadmin', 'regional-admin'].includes(this.role.id))
        return {
          eyebrow: 'REGIÓN SANITARIA · CORTÉS',
          title: 'Consolidado regional',
          description: 'Cobertura municipal y preparación del envío a Nivel Central.',
        };
      return {
        eyebrow: 'COORDINACIÓN MUNICIPAL · PUERTO CORTÉS',
        title: 'Consolidado municipal',
        description: 'Cobertura de establecimientos y preparación del envío regional.',
      };
    }
    if (this.active === 'Mapas') {
      if (['superadmin', 'central-validator'].includes(this.role.id))
        return {
          eyebrow: 'ANÁLISIS TERRITORIAL · HONDURAS',
          title: 'Mapa nacional ITS',
          description: 'Comparación agregada por región, sin exposición de registros individuales.',
        };
      if (['regional-superadmin', 'regional-admin', 'supervisor'].includes(this.role.id))
        return {
          eyebrow: 'ANÁLISIS TERRITORIAL · CORTÉS',
          title: 'Mapa regional ITS',
          description: 'Indicadores agregados por municipio dentro del alcance autorizado.',
        };
      if (this.role.id === 'establishment-manager')
        return {
          eyebrow: 'ESTABLECIMIENTO · CIS LINDA COELLO',
          title: 'Mapa del establecimiento',
          description: 'Producción propia y referencia territorial de procedencias.',
        };
    }
    if (this.active === 'Reportes y exportaciones') {
      const scope =
        this.role.id === 'central-validator' || this.role.id === 'superadmin'
          ? 'nacionales'
          : this.role.id.startsWith('regional-') || this.role.id === 'supervisor'
            ? 'regionales'
            : this.role.id === 'establishment-manager'
              ? 'del establecimiento'
              : 'municipales';
      return {
        eyebrow: `GESTIÓN DOCUMENTAL · ${this.role.scopeLabel.toUpperCase()}`,
        title: 'Reportes y exportaciones',
        description: `Informes ${scope} disponibles según alcance y nivel de datos autorizado.`,
      };
    }
    return SCREEN_META[this.active];
  }
  private productionMeta() {
    const metadata: Record<string, { eyebrow: string; title: string; description: string }> = {
      Inicio: {
        eyebrow: this.role.roleName.toUpperCase(),
        title: 'Panel institucional',
        description: 'Indicadores y prioridades calculados dentro del alcance vigente.',
      },
      'Captura ITS 1': {
        eyebrow: 'REGISTRO INDIVIDUAL AUTORIZADO',
        title: 'Captura de atención ITS 1',
        description: 'Registro individual limitado a los establecimientos asignados.',
      },
      'Reporte ITS 2': {
        eyebrow: 'REPORTE MENSUAL',
        title: 'Reporte mensual ITS 2',
        description: 'Consolidación mensual dentro del alcance institucional vigente.',
      },
      'Bandeja de revisión': {
        eyebrow: 'FLUJO DE VALIDACIÓN',
        title: 'Bandeja de revisión',
        description: 'Reportes pendientes dentro del alcance autorizado.',
      },
      Consolidados: {
        eyebrow: 'CONSOLIDACIÓN ITS',
        title: 'Consolidados institucionales',
        description: 'Cobertura, calidad y versiones persistidas del período seleccionado.',
      },
      Mapas: {
        eyebrow: 'ANÁLISIS TERRITORIAL',
        title: 'Mapa de indicadores ITS',
        description: 'Indicadores agregados sin exposición de registros individuales.',
      },
      Redes: {
        eyebrow: 'REDES DE SALUD',
        title: 'Gestión de Redes',
        description: 'Catálogo y composición dentro del alcance territorial autorizado.',
      },
      'Reportes y exportaciones': {
        eyebrow: 'GESTIÓN DOCUMENTAL',
        title: 'Reportes y exportaciones',
        description: 'Archivos disponibles según rol, territorio y nivel de datos vigente.',
      },
      Administración: {
        eyebrow: 'ADMINISTRACIÓN TERRITORIAL',
        title: 'Administración institucional',
        description: 'Gestión limitada a las entidades y permisos asignados.',
      },
    };
    return metadata[this.active] ?? metadata['Inicio']!;
  }
  get showPrimaryAction() {
    return (
      this.active === 'Inicio' ||
      (this.active === 'Administración' && !this.showPeriodAdministration)
    );
  }
  get showGlobalFilters() {
    return [
      'Inicio',
      'Bandeja de revisión',
      'Consolidados',
      'Mapas',
      'Redes',
      'Reportes y exportaciones',
      'Reporte ITS 2',
    ].includes(this.active);
  }

  navigate(page: string) {
    if (
      !this.auth.isDemo() &&
      !this.operationalPeriod.periods().length &&
      page !== 'Administración'
    ) {
      this.showNotice(
        'Configure primero el calendario institucional desde Administración → Períodos.',
      );
      return;
    }
    this.active = page;
    this.selectedReport = null;
  }

  changeRole(roleId: RoleId) {
    if (!this.auth.isDemo() && !this.allowedRoleIds.includes(roleId)) return;
    this.roleContext.select(roleId);
    if (roleId === 'establishment-manager') this.establishmentContext.select('85481');
    if (roleId === 'coordination-digitizer') this.establishmentContext.select('2721');
    this.active = 'Inicio';
    this.selectedReport = null;
    this.showNotice(`Vista activa: ${this.role.roleName}.`);
  }

  selectReport(report: Report) {
    this.selectedReport = report;
  }

  signOut() {
    this.auth.signOut();
    this.active = 'Inicio';
    this.selectedReport = null;
  }

  leaveEmailAction() {
    this.auth.signOut();
    this.emailAccess.close();
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    if (typeof localStorage !== 'undefined')
      localStorage.setItem('sigvits-theme', this.darkMode ? 'dark' : 'light');
    this.applyTheme();
    this.showNotice(this.darkMode ? 'Modo oscuro activado.' : 'Modo claro activado.');
  }

  private applyTheme() {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset['theme'] = this.darkMode ? 'dark' : 'light';
    document.documentElement.style.colorScheme = this.darkMode ? 'dark' : 'light';
  }

  primaryAction() {
    if (this.active === 'Inicio') {
      this.navigate(this.role.primaryTarget);
      return;
    }
    if (this.active === 'Administración') {
      this.territory?.openCreate(this.role.id === 'superadmin' ? 'region' : 'municipality');
      return;
    }
    const messages: Record<string, string> = {
      Inicio: 'Preparando consolidado municipal de julio 2026…',
      'Captura ITS 1': 'Atención guardada correctamente.',
      'Reporte ITS 2': 'Reporte enviado a coordinación municipal.',
      Consolidados: 'Consolidado municipal generado como versión 1.',
      'Reportes y exportaciones': 'Nueva exportación agregada a la cola.',
      Administración: 'Formulario de nuevo establecimiento abierto.',
    };
    this.showNotice(messages[this.active] ?? 'Acción registrada correctamente.');
  }

  primaryLabel() {
    if (this.active === 'Inicio') return this.role.primaryLabel;
    if (this.active === 'Administración')
      return this.role.id === 'superadmin' ? 'Nueva región' : 'Nuevo municipio';
    const labels: Record<string, string> = {
      'Reporte ITS 2': 'Enviar a coordinación',
      'Reportes y exportaciones': 'Generar reporte',
      Administración: 'Nuevo establecimiento',
      'Captura ITS 1': 'Guardar atención',
    };
    return labels[this.active] ?? 'Generar consolidado';
  }

  showNotice(message: string) {
    this.notice = message;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => (this.notice = ''), 3200);
  }

  handleDrawerAction(message: string) {
    this.selectedReport = null;
    this.reviewInbox?.reload();
    this.reviewNotifications.refresh();
    this.maps?.reload();
    this.showNotice(message);
  }
}
