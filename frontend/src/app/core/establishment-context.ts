import { computed, Injectable, signal } from '@angular/core';
import { Establishment } from './models';

@Injectable({ providedIn: 'root' })
export class EstablishmentContext {
  private readonly catalog = signal<Establishment[]>([
    { code: '2721', name: 'Policlínico Cornelio Moncada Puerto Cortés', type: 'Policlínico' },
    { code: '85481', name: 'CIS Linda Coello', type: 'CIS' },
    { code: '2771', name: 'UAPS La Pita', type: 'UAPS' },
    { code: '2739', name: 'CIS Bajamar', type: 'CIS' },
    { code: '82899', name: 'UAPS Travesia', type: 'UAPS' },
    { code: '82881', name: 'UAPS Saraguayna', type: 'UAPS' },
    { code: '83453', name: 'CIS Fraternidad', type: 'CIS' },
    { code: '2747', name: 'CIS Baracoa', type: 'CIS' },
    { code: '9563', name: 'UAPS Calan', type: 'UAPS' },
    { code: '2780', name: 'UAPS Puente Alto', type: 'UAPS' },
    { code: '2755', name: 'UAPS Caoba', type: 'UAPS' },
    { code: '2763', name: 'UAPS Kele Kele', type: 'UAPS' },
  ]);

  get establishments(): readonly Establishment[] {
    return this.catalog();
  }

  readonly selectedCode = signal('2721');
  readonly selected = computed<Establishment>(
    () =>
      this.establishments.find((item) => item.code === this.selectedCode()) ??
      this.establishments[0] ?? {
        code: '',
        name: 'Establecimiento no disponible',
        type: 'CIS' as const,
      },
  );

  select(code: string) {
    if (this.establishments.some((item) => item.code === code)) this.selectedCode.set(code);
  }

  replace(establishments: Establishment[]) {
    this.catalog.set([...establishments]);
    if (!establishments.some((item) => item.code === this.selectedCode()))
      this.selectedCode.set(establishments[0]?.code ?? '');
  }
}
