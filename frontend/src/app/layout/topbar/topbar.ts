import { Component, input, output } from '@angular/core';
import { RoleId, RoleProfile } from '../../core/models';
import { ROLE_PROFILES } from '../../core/role-data';

@Component({ selector: 'app-topbar', templateUrl: './topbar.html', styleUrl: './topbar.css' })
export class Topbar {
  readonly role = input.required<RoleProfile>();
  readonly darkMode = input(false);
  readonly themeToggle = output<void>();
  readonly roleChange = output<RoleId>();
  protected readonly roles = ROLE_PROFILES;

  changeRole(event: Event) {
    this.roleChange.emit((event.target as HTMLSelectElement).value as RoleId);
  }
}
