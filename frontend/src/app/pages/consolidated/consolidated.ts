import { Component, inject, output } from '@angular/core';
import { RoleContext } from '../../core/role-context';

@Component({ selector: 'app-consolidated', templateUrl: './consolidated.html', styleUrl: './consolidated.css' })
export class Consolidated {
  readonly navigate = output<string>();
  private readonly roleContext = inject(RoleContext);

  get view() {
    const role = this.roleContext.activeRoleId();
    if (role === 'central-validator') return {
      level: 'nacional', source: 'regiones sanitarias', received: '1 de 18 regiones', completion: 6,
      approved: 0, review: 1, returned: 0, pending: 17, blockers: 1,
      total: 280, newCases: 211, controls: 69, next: 'Publicación nacional',
      blocking: 'Cortés requiere validación y 17 regiones aún no han enviado.',
      steps: ['ITS 2 institucional', 'Consolidado municipal', 'Consolidado regional', 'Revisión central', 'Publicación nacional'], current: 3,
    };
    if (role === 'regional-admin' || role === 'regional-superadmin') return {
      level: 'regional', source: 'municipios de Cortés', received: '2 de 12 municipios', completion: 17,
      approved: 1, review: 1, returned: 0, pending: 10, blockers: 1,
      total: 280, newCases: 211, controls: 69, next: 'Envío a Nivel Central',
      blocking: 'Puerto Cortés sigue en revisión y 10 municipios no han enviado.',
      steps: ['ITS 2 institucional', 'Consolidado municipal', 'Revisión regional', 'Consolidado de Cortés', 'Nivel Central'], current: 2,
    };
    return {
      level: 'municipal', source: 'establecimientos de Puerto Cortés', received: '9 de 12 establecimientos', completion: 75,
      approved: 6, review: 2, returned: 1, pending: 3, blockers: 4,
      total: 184, newCases: 139, controls: 45, next: 'Envío a Región de Cortés',
      blocking: 'Hay 4 reportes que requieren acción antes de cerrar.',
      steps: ['Captura ITS 1', 'Generación ITS 2', 'Revisión municipal', 'Consolidado de Puerto Cortés', 'Región de Cortés'], current: 2,
    };
  }
}
