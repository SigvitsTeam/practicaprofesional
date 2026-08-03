import { computed, Injectable, signal } from '@angular/core';
import { Establishment } from './models';

@Injectable({ providedIn: 'root' })
export class EstablishmentContext {
  readonly establishments: Establishment[] = [
    { code: 'CIS-001', name: 'CIS Cornelio Moncada Córdova', type: 'CIS' },
    { code: 'CIS-002', name: 'CIS Medina', type: 'CIS' },
    { code: 'UAPS-003', name: 'UAPS Bajamar', type: 'UAPS' },
    { code: 'UAPS-004', name: 'UAPS Cieneguita', type: 'UAPS' },
    { code: 'UAPS-005', name: 'UAPS Chameleconcito', type: 'UAPS' },
    { code: 'UAPS-006', name: 'UAPS Baracoa', type: 'UAPS' },
    { code: 'UAPS-007', name: 'UAPS Campana', type: 'UAPS' },
    { code: 'UAPS-008', name: 'UAPS Río Mar', type: 'UAPS' },
    { code: 'UAPS-009', name: 'UAPS Garífuna', type: 'UAPS' },
    { code: 'UAPS-010', name: 'UAPS Travesía', type: 'UAPS' },
    { code: 'UAPS-011', name: 'UAPS El Chile', type: 'UAPS' },
    { code: 'UAPS-012', name: 'UAPS Puente Alto', type: 'UAPS' },
  ];

  readonly selectedCode = signal('CIS-002');
  readonly selected = computed(() => this.establishments.find(item => item.code === this.selectedCode()) ?? this.establishments[0]);

  select(code: string) {
    if (this.establishments.some(item => item.code === code)) this.selectedCode.set(code);
  }
}
