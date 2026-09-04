import { Component, input, output } from '@angular/core';
import { NAV_ITEMS } from '../../core/mock-data';
import { RoleProfile } from '../../core/models';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  readonly active = input.required<string>();
  readonly role = input.required<RoleProfile>();
  readonly reviewCount = input(0);
  readonly navigate = output<string>();

  protected items(group: 'Operación' | 'Gestión') {
    return NAV_ITEMS.filter(
      (item) => item.group === group && this.role().navItems.includes(item.label),
    );
  }

  protected countFor(label: string) {
    if (label !== 'Bandeja de revisión') return undefined;
    return this.reviewCount() || undefined;
  }
}
