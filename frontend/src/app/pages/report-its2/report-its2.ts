import { Component, DestroyRef, effect, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { EstablishmentContext } from '../../core/establishment-context';
import { ItsCaptureApiService, ItsMonthlyReportResponse } from '../../core/its-capture-api.service';
import { RoleContext } from '../../core/role-context';
import { EstablishmentSelector } from '../../shared/establishment-selector/establishment-selector';

@Component({
  selector: 'app-report-its2',
  imports: [EstablishmentSelector],
  templateUrl: './report-its2.html',
  styleUrl: './report-its2.css',
})
export class ReportIts2 implements OnInit {
  readonly notify = output<string>();
  protected readonly context = inject(EstablishmentContext);
  protected readonly roleContext = inject(RoleContext);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly report = signal<ItsMonthlyReportResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly year = 2026;
  protected readonly month = 8;
  private contextReady = false;

  constructor() {
    effect(() => {
      const facilityId = this.context.selected().id;
      if (this.contextReady && facilityId) this.loadReport(facilityId);
    });
  }

  ngOnInit() {
    if (this.auth.isDemo()) return;
    this.loading.set(true);
    this.api.getContext().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: context => {
        this.context.replace(context.facilities.map(item => ({
          id: item.id,
          code: item.code,
          name: item.name,
          type: item.type === 'POLICLINICO' ? 'Policlínico' : item.type as 'CIS' | 'UAPS',
        })));
        this.contextReady = true;
        const facilityId = this.context.selected().id;
        if (facilityId) this.loadReport(facilityId);
      },
      error: () => this.loadError.set('No fue posible cargar los establecimientos autorizados.'),
    });
  }

  protected get canSelectEstablishment() {
    return this.roleContext.activeRoleId() === 'coordination-digitizer';
  }

  protected get total() { return this.report()?.totalAttentions ?? 0; }
  protected get newCases() {
    return this.report()?.rows.reduce((sum, row) => sum + row.diagnosis.newCases, 0) ?? 0;
  }
  protected get controls() {
    return this.report()?.rows.reduce((sum, row) => sum + row.diagnosis.controls, 0) ?? 0;
  }
  protected get correctionRequested() { return false; }

  protected classificationTotal(classificationCode: string) {
    const rows = this.report()?.rows.filter(row => row.classificationCode === classificationCode) ?? [];
    return {
      male: rows.reduce((sum, row) => sum + row.sex.male, 0),
      female: rows.reduce((sum, row) => sum + row.sex.female, 0),
      newCases: rows.reduce((sum, row) => sum + row.diagnosis.newCases, 0),
      controls: rows.reduce((sum, row) => sum + row.diagnosis.controls, 0),
    };
  }

  protected reload() {
    const facilityId = this.context.selected().id;
    if (facilityId) this.loadReport(facilityId);
  }

  protected downloadFilledIts2() {
    const facility = this.context.selected();
    if (!facility.id) {
      this.notify.emit('Inicie sesión para generar el ITS-2 con datos reales.');
      return;
    }
    this.loading.set(true);
    this.api.downloadMonthlyReportPdf(facility.id, this.year, this.month).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: blob => this.downloadBlob(
        blob,
        `ITS-2-${facility.code}-${this.year}-${String(this.month).padStart(2, '0')}.pdf`,
        'ITS-2 oficial generado y descargado.',
      ),
      error: () => this.notify.emit('No fue posible generar el PDF ITS-2.'),
    });
  }

  protected downloadFilledIts1() {
    const facility = this.context.selected();
    if (!facility.id) {
      this.notify.emit('Inicie sesión para generar el ITS-1 con datos reales.');
      return;
    }
    this.loading.set(true);
    this.api.downloadIts1RegisterPdf(facility.id, this.year, this.month).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: blob => this.downloadBlob(
        blob,
        `ITS-1-${facility.code}-${this.year}-${String(this.month).padStart(2, '0')}.pdf`,
        'ITS-1 oficial generado y descargado.',
      ),
      error: () => this.notify.emit('No fue posible generar el PDF ITS-1.'),
    });
  }

  private downloadBlob(blob: Blob, filename: string, message: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    this.notify.emit(message);
  }

  private loadReport(facilityId: string) {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getMonthlyReport(facilityId, this.year, this.month).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: report => this.report.set(report),
      error: () => {
        this.report.set(null);
        this.loadError.set('No fue posible generar el consolidado ITS-2 del período.');
      },
    });
  }
}
