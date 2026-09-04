import { effect, inject, Injectable, signal } from '@angular/core';
import { type Observable, type Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { ItsCaptureApiService } from './its-capture-api.service';
import { OperationalPeriodService } from './operational-period';
import { RoleContext } from './role-context';

interface ReviewNotificationItem {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewNotificationsService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  private readonly periods = inject(OperationalPeriodService);
  private readonly roles = inject(RoleContext);
  private request?: Subscription;
  private requestVersion = 0;

  readonly count = signal(0);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      this.auth.user();
      this.auth.isDemo();
      this.roles.activeRoleId();
      const periodKey = this.periods.selectedEndKey();
      if (periodKey) this.refresh();
      else this.clear();
    });
  }

  refresh(): void {
    const period = this.periods.selected();
    const role = this.roles.activeRoleId();
    if (!this.auth.user() || this.auth.isDemo() || !period) {
      this.clear();
      return;
    }

    let request: Observable<ReviewNotificationItem[]> | undefined;
    let actionableStatus = '';
    if (role === 'municipal-coordinator') {
      request = this.api.getMunicipalIts2Inbox(period.year, period.month);
      actionableStatus = 'ENVIADO_A_MUNICIPIO';
    } else if (role === 'regional-admin' || role === 'regional-superadmin') {
      request = this.api.getRegionalConsolidationInbox(period.year, period.month);
      actionableStatus = 'ENVIADO_A_REGION';
    } else if (role === 'central-validator') {
      request = this.api.getCentralConsolidationInbox(period.year, period.month);
      actionableStatus = 'ENVIADO_A_CENTRAL';
    }

    if (!request) {
      this.clear();
      return;
    }

    const requestVersion = ++this.requestVersion;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.request = request.subscribe({
      next: (items) => {
        if (requestVersion !== this.requestVersion) return;
        this.count.set(items.filter((item) => item.status === actionableStatus).length);
        this.loading.set(false);
      },
      error: () => {
        if (requestVersion !== this.requestVersion) return;
        this.count.set(0);
        this.loading.set(false);
      },
    });
  }

  private clear(): void {
    this.requestVersion += 1;
    this.request?.unsubscribe();
    this.request = undefined;
    this.count.set(0);
    this.loading.set(false);
  }
}
