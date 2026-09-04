import { Component, input, output } from '@angular/core';
import { RoleId, RoleProfile } from '../../core/models';
import { ROLE_PROFILES } from '../../core/role-data';

@Component({ selector: 'app-topbar', templateUrl: './topbar.html', styleUrl: './topbar.css' })
export class Topbar {
  readonly role = input.required<RoleProfile>();
  readonly darkMode = input(false);
  readonly availableRoles = input<RoleProfile[]>([]);
  readonly demoMode = input(false);
  readonly userName = input('Usuario autenticado');
  readonly userInitials = input('UA');
  readonly reviewCount = input(0);
  readonly themeToggle = output<void>();
  readonly roleChange = output<RoleId>();
  readonly logout = output<void>();
  readonly notificationsOpen = output<void>();
  protected readonly demoRoles = ROLE_PROFILES;
  protected get roles() {
    return this.demoMode() ? this.demoRoles : this.availableRoles();
  }

  changeRole(event: Event) {
    this.roleChange.emit((event.target as HTMLSelectElement).value as RoleId);
  }
}
