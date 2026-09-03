import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, Subscription } from 'rxjs';
import {
  PeriodAdminApiService,
  type ManagedPeriodRecord,
  type PeriodAuditRecord,
} from '../../core/period-admin-api.service';
import { AuthService } from '../../core/auth.service';
import { RoleContext } from '../../core/role-context';
import { OperationalPeriodService } from '../../core/operational-period';
import {
  formatHondurasDateTime,
  formatHondurasMonth,
  hondurasDateParts,
} from '../../core/honduras-date';

@Component({
  selector: 'app-period-administration',
  imports: [FormsModule],
  templateUrl: './period-administration.html',
  styleUrl: './period-administration.css',
})
export class PeriodAdministration {
  private readonly api = inject(PeriodAdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly role = inject(RoleContext);
  private readonly operational = inject(OperationalPeriodService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private catalogRequest?: Subscription;
  private historyRequest?: Subscription;
  readonly year = signal(hondurasDateParts().year);
  readonly periods = signal<ManagedPeriodRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly action = signal<
    | { kind: 'create'; year: number }
    | { kind: 'open'; period: ManagedPeriodRecord }
    | null
    | { kind: 'open-year'; year: number; periods: ManagedPeriodRecord[] }
  >(null);
  readonly historyFor = signal<ManagedPeriodRecord | null>(null);
  readonly history = signal<PeriodAuditRecord[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  reason = '';
  confirmed = false;
  readonly monthLabel = formatHondurasMonth;
  readonly dateTime = formatHondurasDateTime;
  get allowed() {
    return ['superadmin', 'central-validator'].includes(this.role.activeRoleId());
  }
  get demo() {
    return this.auth.isDemo();
  }
  get canOpenYear() {
    const periods = this.periods();
    return (
      periods.length === 12 &&
      periods.some((p) => p.status === 'BLOQUEADO') &&
      periods.every((p) => p.status !== 'BLOQUEADO' || p.calendarReady)
    );
  }

  constructor() {
    this.load();
  }
  load() {
    if (this.saving()) return;
    this.catalogRequest?.unsubscribe();
    this.periods.set([]);
    this.error.set('');
    this.feedback.set('');
    if (!this.allowed || this.demo) return;
    if (!Number.isInteger(this.year()) || this.year() < 2020 || this.year() > 2100) {
      this.error.set('Indique un año entre 2020 y 2100.');
      return;
    }
    this.loading.set(true);
    this.catalogRequest = this.api
      .list(this.year())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (rows) => this.periods.set(rows),
        error: (error) =>
          this.error.set(this.message(error, 'No fue posible cargar los períodos.')),
      });
  }
  changeYear(value: number) {
    if (this.saving() || this.action()) return;
    this.year.set(Number(value));
    this.load();
  }
  create() {
    if (
      !this.canStart() ||
      !Number.isInteger(this.year()) ||
      this.year() < 2020 ||
      this.year() > 2100
    )
      return;
    this.prepare();
    this.action.set({ kind: 'create', year: this.year() });
    this.presentDialog('textarea');
  }
  open(period: ManagedPeriodRecord) {
    if (!this.canStart() || period.status !== 'BLOQUEADO' || !period.calendarReady) return;
    this.prepare();
    this.action.set({ kind: 'open', period });
    this.presentDialog('textarea');
  }
  openYear() {
    if (!this.canStart() || !this.canOpenYear) return;
    this.prepare();
    this.action.set({ kind: 'open-year', year: this.year(), periods: [...this.periods()] });
    this.reason = `Habilitar captura durante todos los meses disponibles de ${this.year()}.`;
    this.presentDialog('textarea');
  }
  cancel() {
    if (!this.saving()) {
      this.closeDialog();
      this.action.set(null);
      this.reason = '';
      this.confirmed = false;
      this.error.set('');
    }
  }
  submit() {
    const action = this.action();
    if (
      !action ||
      this.saving() ||
      !this.allowed ||
      this.demo ||
      !this.confirmed ||
      this.reason.trim().length < 10 ||
      this.reason.trim().length > 500
    )
      return;
    this.saving.set(true);
    this.error.set('');
    const next = () => {
      this.saving.set(false);
      this.closeDialog();
      this.action.set(null);
      this.reason = '';
      this.confirmed = false;
      this.load();
      this.feedback.set(
        action.kind === 'create'
          ? 'Calendario completado. Los meses nuevos permanecen bloqueados.'
          : action.kind === 'open-year'
            ? 'Meses disponibles del año habilitados. Se conservaron los cierres oficiales existentes.'
            : 'Período abierto para todo el país.',
      );
      // Refresh shared filters without changing the current operator selection.
      this.operational
        .fetchCatalog(true)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (periods) => this.operational.refreshCatalog(periods),
          error: () =>
            this.feedback.update(
              (text) => `${text} No se actualizaron los filtros; recargue antes de operar.`,
            ),
        });
    };
    const error = (cause: unknown) =>
      this.error.set(
        this.message(
          cause,
          'No se pudo confirmar la operación. Actualice el listado antes de reintentar.',
        ),
      );
    const finish = () => this.saving.set(false);
    if (action.kind === 'create')
      this.api
        .createCalendar(action.year, this.reason.trim(), this.confirmed)
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(finish))
        .subscribe({ next, error });
    else if (action.kind === 'open-year')
      this.api
        .openYear(action.year, action.periods, this.reason.trim(), this.confirmed)
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(finish))
        .subscribe({ next, error });
    else
      this.api
        .open(action.period, this.reason.trim(), this.confirmed)
        .pipe(takeUntilDestroyed(this.destroyRef), finalize(finish))
        .subscribe({ next, error });
  }
  showHistory(period: ManagedPeriodRecord) {
    if (this.saving() || this.action() || !this.allowed || this.demo) return;
    this.historyRequest?.unsubscribe();
    this.historyFor.set(period);
    this.history.set([]);
    this.historyError.set('');
    this.historyLoading.set(true);
    this.presentDialog('button');
    this.historyRequest = this.api
      .history(period.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.historyLoading.set(false)),
      )
      .subscribe({
        next: (events) => this.history.set(events),
        error: (error) =>
          this.historyError.set(this.message(error, 'No se pudo cargar la auditoría.')),
      });
  }
  closeHistory() {
    this.historyRequest?.unsubscribe();
    this.closeDialog();
    this.historyFor.set(null);
  }
  private canStart() {
    return (
      this.allowed &&
      !this.demo &&
      !this.loading() &&
      !this.saving() &&
      !this.action() &&
      !this.historyFor()
    );
  }
  private presentDialog(focus: 'textarea' | 'button') {
    // A microtask can run before Angular renders the conditional dialog in zoneless mode.
    afterNextRender(
      () => {
        const dialog = this.host.nativeElement.querySelector<HTMLDialogElement>(
          '.period-dialog:not([open])',
        );
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.open = true;
        dialog.querySelector<HTMLElement>(focus)?.focus();
      },
      { injector: this.injector },
    );
  }
  private closeDialog() {
    const dialog = this.host.nativeElement.querySelector<HTMLDialogElement>('.period-dialog[open]');
    if (typeof dialog?.close === 'function') dialog.close();
    else if (dialog) dialog.open = false;
  }
  private prepare() {
    this.reason = '';
    this.confirmed = false;
    this.error.set('');
    this.feedback.set('');
  }
  private message(error: unknown, fallback: string): string {
    const body = (error as { error?: { detail?: unknown; message?: unknown } })?.error;
    const detail = body?.detail ?? body?.message;
    return typeof detail === 'string' ? detail : fallback;
  }
}
