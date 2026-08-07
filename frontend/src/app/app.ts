import { Component, inject, ViewChild, ViewEncapsulation } from '@angular/core';
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
import { ReportDrawer } from './shared/report-drawer/report-drawer';

@Component({
  selector: 'app-root',
  imports: [Sidebar, Topbar, GlobalFilters, RoleDashboard, CaptureIts1, ReportIts2, ReviewInbox, Consolidated, Maps, Networks, Exports, Territory, ReportDrawer],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None
})
export class App {
  @ViewChild(Territory) private territory?: Territory;
  protected readonly roleContext = inject(RoleContext);
  private readonly establishmentContext = inject(EstablishmentContext);
  active = 'Inicio';
  selectedReport: Report | null = null;
  notice = '';
  darkMode = false;
  private noticeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('sigvits-theme') : null;
    const systemPrefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
    this.darkMode = savedTheme ? savedTheme === 'dark' : systemPrefersDark;
    this.applyTheme();
  }

  get role() { return this.roleContext.activeRole(); }
  get meta() {
    if (this.active === 'Inicio') return this.role.dashboardMeta;
    if (this.active === 'Captura ITS 1' && this.role.id === 'establishment-manager') {
      return { eyebrow: 'ESTABLECIMIENTO · CIS LINDA COELLO', title: 'Captura de atención ITS 1', description: 'Registro individual correspondiente al establecimiento asignado.' };
    }
    if (this.active === 'Reporte ITS 2' && this.role.id === 'establishment-manager') {
      return { eyebrow: 'ESTABLECIMIENTO · CIS LINDA COELLO', title: 'Reporte mensual ITS 2', description: 'Consolidado propio para envío a la Coordinación de Puerto Cortés.' };
    }
    if (this.active === 'Administración' && this.role.id === 'superadmin') {
      return { eyebrow: 'ADMINISTRACIÓN GLOBAL · HONDURAS', title: 'Administración territorial', description: 'Gestión nacional de regiones, municipios y sus niveles dependientes.' };
    }
    if (this.active === 'Administración' && this.role.id === 'regional-superadmin') {
      return { eyebrow: 'SUPERADMIN REGIONAL · CORTÉS', title: 'Administración territorial de Cortés', description: 'Gestión de municipios, establecimientos y usuarios dentro de la región asignada.' };
    }
    if (this.active === 'Redes' && this.role.id === 'superadmin') {
      return { eyebrow: 'ADMINISTRACIÓN GLOBAL · REDES', title: 'Gestión de Redes de salud', description: 'Administración de redes y municipios asociados en cualquier región.' };
    }
    if (this.active === 'Redes' && this.role.id === 'regional-superadmin') {
      return { eyebrow: 'SUPERADMIN REGIONAL · CORTÉS', title: 'Redes de la Región de Cortés', description: 'Administración, consolidación y exportación de agrupaciones municipales.' };
    }
    if (this.active === 'Redes') {
      return { eyebrow: 'ANÁLISIS AGREGADO · REDES', title: 'Consolidado por Redes', description: 'Consulta, filtros, comparativos y exportaciones de producción municipal agregada.' };
    }
    return SCREEN_META[this.active];
  }
  get showPrimaryAction() { return this.active === 'Inicio' || ['Consolidados', 'Reportes y exportaciones', 'Administración'].includes(this.active); }
  get showGlobalFilters() {
    return ['Inicio', 'Bandeja de revisión', 'Consolidados', 'Mapas', 'Redes', 'Reportes y exportaciones'].includes(this.active);
  }

  navigate(page: string) {
    this.active = page;
    this.selectedReport = null;
  }

  changeRole(roleId: RoleId) {
    this.roleContext.select(roleId);
    if (roleId === 'establishment-manager') this.establishmentContext.select('85481');
    if (roleId === 'coordination-digitizer') this.establishmentContext.select('2721');
    this.active = 'Inicio';
    this.selectedReport = null;
    this.showNotice(`Vista activa: ${this.role.roleName}.`);
  }

  selectReport(report: Report) { this.selectedReport = report; }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    if (typeof localStorage !== 'undefined') localStorage.setItem('sigvits-theme', this.darkMode ? 'dark' : 'light');
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
      'Inicio': 'Preparando consolidado municipal de julio 2026…',
      'Captura ITS 1': 'Atención guardada correctamente.',
      'Reporte ITS 2': 'Reporte enviado a coordinación municipal.',
      'Consolidados': 'Consolidado municipal generado como versión 1.',
      'Reportes y exportaciones': 'Nueva exportación agregada a la cola.',
      'Administración': 'Formulario de nuevo establecimiento abierto.'
    };
    this.showNotice(messages[this.active] ?? 'Acción registrada correctamente.');
  }

  primaryLabel() {
    if (this.active === 'Inicio') return this.role.primaryLabel;
    if (this.active === 'Administración') return this.role.id === 'superadmin' ? 'Nueva región' : 'Nuevo municipio';
    const labels: Record<string, string> = {
      'Reporte ITS 2': 'Enviar a coordinación',
      'Reportes y exportaciones': 'Generar reporte',
      'Administración': 'Nuevo establecimiento',
      'Captura ITS 1': 'Guardar atención'
    };
    return labels[this.active] ?? 'Generar consolidado';
  }

  showNotice(message: string) {
    this.notice = message;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice = '', 3200);
  }

  handleDrawerAction(message: string) {
    this.selectedReport = null;
    this.showNotice(message);
  }
}
