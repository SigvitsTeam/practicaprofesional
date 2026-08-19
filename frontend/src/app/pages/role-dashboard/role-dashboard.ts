import { Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import {
  ItsCaptureApiService,
  TerritorialAnalyticsLevel,
  TerritorialAnalyticsResponse,
} from '../../core/its-capture-api.service';
import { RoleMetric, RoleProfile, RoleTask } from '../../core/models';

@Component({
  selector: 'app-role-dashboard',
  templateUrl: './role-dashboard.html',
  styleUrl: './role-dashboard.css'
})
export class RoleDashboard {
  readonly role = input.required<RoleProfile>();
  readonly navigate = output<string>();
  readonly notify = output<string>();
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rows = signal<TerritorialAnalyticsResponse['rows']>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  private requestVersion = 0;

  protected readonly metrics = computed<RoleMetric[]>(() => {
    if (this.auth.isDemo()) return this.role().metrics;
    const rows = this.rows();
    const withReport = rows.filter(row => row.status !== 'SIN_REPORTE').length;
    return [
      { label: 'Territorios visibles', value: String(rows.length), detail: 'Dentro del alcance autorizado', tone: 'purple' },
      { label: 'Reportes vigentes', value: String(withReport), detail: `${rows.length - withReport} pendientes de preparación`, tone: 'green' },
      { label: 'Atenciones reportadas', value: String(rows.reduce((sum, row) => sum + row.attentions, 0)), detail: 'Versiones ITS 2 vigentes', tone: 'blue' },
      { label: 'Alertas abiertas', value: String(rows.reduce((sum, row) => sum + row.alerts, 0)), detail: 'Observaciones que requieren seguimiento', tone: 'amber' },
    ];
  });

  protected readonly tasks = computed<RoleTask[]>(() => {
    if (this.auth.isDemo()) return this.role().tasks;
    const rows = this.rows();
    const missing = rows.filter(row => row.status === 'SIN_REPORTE');
    const returned = rows.filter(row => row.status.startsWith('DEVUELTO'));
    const alerts = rows.reduce((sum, row) => sum + row.alerts, 0);
    const tasks: RoleTask[] = [];
    const facilityLevel = this.levelFor(this.role()) === 'ESTABLECIMIENTO';
    if (missing.length)
      tasks.push({ title: `${missing.length} ${missing.length === 1 ? 'territorio' : 'territorios'} sin reporte vigente`, detail: this.sample(missing), status: 'Pendiente', target: facilityLevel ? 'Reporte ITS 2' : 'Consolidados' });
    if (returned.length)
      tasks.push({ title: `${returned.length} ${returned.length === 1 ? 'reporte devuelto' : 'reportes devueltos'}`, detail: this.sample(returned), status: 'Corrección', target: facilityLevel ? 'Reporte ITS 2' : 'Bandeja de revisión' });
    if (alerts)
      tasks.push({ title: `${alerts} ${alerts === 1 ? 'observación abierta' : 'observaciones abiertas'}`, detail: 'Revise los reportes observados dentro de su alcance.', status: 'Revisión', target: facilityLevel ? 'Reporte ITS 2' : 'Bandeja de revisión' });
    if (!tasks.length)
      tasks.push({ title: 'Sin alertas operativas', detail: 'Los reportes visibles no tienen pendientes detectados.', status: 'Al día', target: facilityLevel ? 'Reporte ITS 2' : 'Bandeja de revisión' });
    return tasks;
  });

  constructor() {
    effect(() => {
      const role = this.role();
      const demo = this.auth.isDemo();
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
    this.loadError.set('');
    if (demo) { this.loading.set(false); return; }
    const level = this.levelFor(role);
    const now = new Date();
    this.loading.set(true);
    this.api.getTerritorialAnalytics(level, now.getUTCFullYear(), now.getUTCMonth() + 1).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (requestVersion === this.requestVersion) this.loading.set(false); }),
    ).subscribe({
      next: result => { if (requestVersion === this.requestVersion) this.rows.set(result.rows); },
      error: () => { if (requestVersion === this.requestVersion) this.loadError.set('No fue posible cargar los indicadores reales del panel.'); },
    });
  }

  private levelFor(role: RoleProfile): TerritorialAnalyticsLevel {
    if (['superadmin', 'central-validator'].includes(role.id)) return 'REGION';
    if (['regional-superadmin', 'regional-admin', 'supervisor'].includes(role.id)) return 'MUNICIPIO';
    return 'ESTABLECIMIENTO';
  }

  private sample(rows: TerritorialAnalyticsResponse['rows']): string {
    const names = rows.slice(0, 3).map(row => row.name).join(', ');
    return rows.length > 3 ? `${names} y ${rows.length - 3} más.` : names;
  }
}
