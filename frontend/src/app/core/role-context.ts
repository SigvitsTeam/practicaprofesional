import { computed, Injectable, signal } from '@angular/core';
import { RoleId } from './models';
import { ROLE_PROFILES } from './role-data';

@Injectable({ providedIn: 'root' })
export class RoleContext {
  readonly roles = ROLE_PROFILES;
  readonly activeRoleId = signal<RoleId>('municipal-coordinator');
  readonly activeRole = computed(
    () => this.roles.find((role) => role.id === this.activeRoleId()) ?? this.roles[0],
  );

  select(roleId: RoleId) {
    if (this.roles.some((role) => role.id === roleId)) this.activeRoleId.set(roleId);
  }
}
