import { Component, effect, inject, input } from '@angular/core';
import { EstablishmentContext } from '../../core/establishment-context';
import { AuthService } from '../../core/auth.service';
import { RoleId, RoleProfile } from '../../core/models';
import { OperationalPeriodService } from '../../core/operational-period';

@Component({
  selector: 'app-global-filters',
  templateUrl: './global-filters.html',
  styleUrl: './global-filters.css',
})
export class GlobalFilters {
  readonly role = input.required<RoleProfile>();
  private readonly establishmentContext = inject(EstablishmentContext);
  private readonly auth = inject(AuthService);
  protected readonly operationalPeriod = inject(OperationalPeriodService);
  protected selectedWeekStart = 'SE 27';
  protected selectedWeekEnd = 'SE 29';
  protected selectedRegion = 'Región de Cortés';
  protected selectedNetwork = 'Todas las redes';
  protected selectedMunicipality = 'Puerto Cortés';
  protected selectedEstablishment = 'Todos los establecimientos';
  protected showTerritoryFilters = false;

  protected readonly weeks = Array.from(
    { length: 29 },
    (_, index) => `SE ${String(index + 1).padStart(2, '0')}`,
  );

  constructor() {
    effect(() => this.resetForRole(this.role().id));
  }

  protected get showRegion() {
    return [
      'superadmin',
      'central-validator',
      'regional-superadmin',
      'regional-admin',
      'supervisor',
    ].includes(this.role().id);
  }
  protected get demoMode() {
    return this.auth.isDemo();
  }
  protected get showNetwork() {
    return this.showRegion;
  }
  protected get showMunicipality() {
    return this.role().id !== 'establishment-manager';
  }
  protected get showEstablishment() {
    return ['municipal-coordinator', 'coordination-digitizer', 'establishment-manager'].includes(
      this.role().id,
    );
  }
  protected get lockRegion() {
    return ['regional-superadmin', 'regional-admin', 'supervisor'].includes(this.role().id);
  }
  protected get lockMunicipality() {
    return ['municipal-coordinator', 'coordination-digitizer'].includes(this.role().id);
  }
  protected get lockEstablishment() {
    return this.role().id === 'establishment-manager';
  }

  protected get regionOptions() {
    if (['superadmin', 'central-validator'].includes(this.role().id))
      return [
        'Todas las regiones',
        'Región de Cortés',
        'Región de Atlántida',
        'Región de Francisco Morazán',
      ];
    return ['Región de Cortés'];
  }

  protected get networkOptions() {
    return this.selectedRegion === 'Región de Cortés'
      ? ['Todas las redes', 'Red Puerto Cortés–Omoa']
      : ['Todas las redes'];
  }

  protected get municipalityOptions() {
    if (this.role().id === 'municipal-coordinator' || this.role().id === 'coordination-digitizer')
      return ['Puerto Cortés'];
    if (this.selectedRegion !== 'Región de Cortés') return ['Todos los municipios'];
    if (this.selectedNetwork === 'Red Puerto Cortés–Omoa')
      return ['Todos los municipios de la Red', 'Puerto Cortés', 'Omoa'];
    return ['Todos los municipios', 'Puerto Cortés', 'Omoa', 'San Pedro Sula', 'Choloma'];
  }

  protected get establishmentOptions() {
    if (this.lockEstablishment) return ['CIS Linda Coello'];
    return [
      'Todos los establecimientos',
      ...this.establishmentContext.establishments.map((item) => item.name),
    ];
  }

  protected get activeScopeSummary() {
    if (!this.demoMode) return 'Alcance institucional autorizado';
    if (this.role().id === 'establishment-manager') return this.selectedEstablishment;
    if (this.showEstablishment)
      return `${this.selectedMunicipality} · ${this.selectedEstablishment}`;
    if (this.showRegion) {
      const parts = [this.selectedRegion];
      if (this.selectedNetwork !== 'Todas las redes') parts.push(this.selectedNetwork);
      if (!this.selectedMunicipality.startsWith('Todos los municipios'))
        parts.push(this.selectedMunicipality);
      return parts.join(' · ');
    }
    return this.selectedMunicipality;
  }

  protected get periodEndOptions() {
    const periods = this.operationalPeriod.periods();
    const start = periods.findIndex(
      (period) => period.key === this.operationalPeriod.selectedStartKey(),
    );
    return periods.slice(Math.max(0, start));
  }

  protected get weekEndOptions() {
    return this.weeks.slice(Math.max(0, this.weeks.indexOf(this.selectedWeekStart)));
  }

  protected setPeriodStart(event: Event) {
    this.operationalPeriod.selectStart((event.target as HTMLSelectElement).value);
  }

  protected setWeekStart(event: Event) {
    this.selectedWeekStart = (event.target as HTMLSelectElement).value;
    if (!this.weekEndOptions.includes(this.selectedWeekEnd))
      this.selectedWeekEnd = this.selectedWeekStart;
  }

  protected setRegion(event: Event) {
    this.selectedRegion = (event.target as HTMLSelectElement).value;
    this.selectedNetwork = 'Todas las redes';
    this.selectedMunicipality =
      this.selectedRegion === 'Región de Cortés' ? 'Todos los municipios' : 'Todos los municipios';
  }

  protected setNetwork(event: Event) {
    this.selectedNetwork = (event.target as HTMLSelectElement).value;
    this.selectedMunicipality =
      this.selectedNetwork === 'Red Puerto Cortés–Omoa'
        ? 'Todos los municipios de la Red'
        : 'Todos los municipios';
  }

  private resetForRole(roleId: RoleId) {
    this.selectedRegion = ['superadmin', 'central-validator'].includes(roleId)
      ? 'Todas las regiones'
      : 'Región de Cortés';
    this.selectedNetwork = 'Todas las redes';
    this.selectedMunicipality = ['municipal-coordinator', 'coordination-digitizer'].includes(roleId)
      ? 'Puerto Cortés'
      : 'Todos los municipios';
    this.selectedEstablishment =
      roleId === 'establishment-manager' ? 'CIS Linda Coello' : 'Todos los establecimientos';
    this.showTerritoryFilters = false;
  }
}
