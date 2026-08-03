import { Component, ViewEncapsulation } from '@angular/core';
import { SCREEN_META } from './core/mock-data';
import { Report } from './core/models';
import { GlobalFilters } from './layout/global-filters/global-filters';
import { Sidebar } from './layout/sidebar/sidebar';
import { Topbar } from './layout/topbar/topbar';
import { CaptureIts1 } from './pages/capture-its1/capture-its1';
import { Consolidated } from './pages/consolidated/consolidated';
import { Dashboard } from './pages/dashboard/dashboard';
import { Exports } from './pages/exports/exports';
import { Maps } from './pages/maps/maps';
import { ReportIts2 } from './pages/report-its2/report-its2';
import { ReviewInbox } from './pages/review-inbox/review-inbox';
import { Territory } from './pages/territory/territory';
import { ReportDrawer } from './shared/report-drawer/report-drawer';

@Component({
  selector: 'app-root',
  imports: [Sidebar, Topbar, GlobalFilters, Dashboard, CaptureIts1, ReportIts2, ReviewInbox, Consolidated, Maps, Exports, Territory, ReportDrawer],
  templateUrl: './app.html',
  styleUrl: './app.css',
  encapsulation: ViewEncapsulation.None
})
export class App {
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

  get meta() { return SCREEN_META[this.active]; }
  get isEstablishment() { return this.active === 'Captura ITS 1' || this.active === 'Reporte ITS 2'; }

  navigate(page: string) {
    this.active = page;
    this.selectedReport = null;
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
