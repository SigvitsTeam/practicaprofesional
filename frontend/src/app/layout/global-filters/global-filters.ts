import { Component, input } from '@angular/core';
import { RoleProfile } from '../../core/models';

@Component({ selector: 'app-global-filters', templateUrl: './global-filters.html', styleUrl: './global-filters.css' })
export class GlobalFilters {
  readonly role = input.required<RoleProfile>();

  get showNetworkFilter() { return ['superadmin', 'central-validator', 'regional-superadmin', 'regional-admin', 'supervisor'].includes(this.role().id); }

  get territoryLabel() {
    if (this.role().id === 'superadmin') return 'Alcance';
    if (this.role().id === 'central-validator') return 'Región';
    if (this.role().id === 'regional-superadmin' || this.role().id === 'regional-admin') return 'Municipio';
    if (this.role().id === 'establishment-manager') return 'Establecimiento';
    if (this.role().id === 'supervisor') return 'Territorio';
    return 'Municipio';
  }

  get territoryOptions() {
    switch (this.role().id) {
      case 'superadmin': return ['Honduras', 'Región de Cortés', 'Puerto Cortés'];
      case 'central-validator': return ['Todas las regiones', 'Región de Cortés'];
      case 'regional-superadmin':
      case 'regional-admin': return ['Todos los municipios', 'Puerto Cortés'];
      case 'establishment-manager': return ['CIS Linda Coello'];
      case 'supervisor': return ['Región de Cortés', 'Puerto Cortés'];
      default: return ['Puerto Cortés'];
    }
  }
}
