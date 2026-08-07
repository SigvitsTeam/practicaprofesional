import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoleContext } from '../../core/role-context';

type NetworkTab = 'summary' | 'municipalities' | 'consolidated' | 'history';

@Component({
  selector: 'app-networks',
  imports: [FormsModule],
  templateUrl: './networks.html',
  styleUrl: './networks.css'
})
export class Networks {
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  protected activeTab: NetworkTab = 'summary';
  protected selectedNetworkId = 'red-puerto-cortes-omoa';
  protected municipalityFilter = 'Todos los municipios';

  protected readonly tabs: { id: NetworkTab; label: string }[] = [
    { id: 'summary', label: 'Resumen' },
    { id: 'municipalities', label: 'Municipios asociados' },
    { id: 'consolidated', label: 'Consolidado' },
    { id: 'history', label: 'Historial' },
  ];

  protected networks = [
    { id: 'red-puerto-cortes-omoa', code: 'RCO-01', name: 'Red Puerto Cortés–Omoa', municipalities: 2, reports: '15 / 18', total: 280, status: 'En pilotaje', configured: true },
    { id: 'pending-02', code: 'POR VALIDAR', name: 'Red pendiente de validación 2', municipalities: 0, reports: '—', total: 0, status: 'Sin configurar', configured: false },
    { id: 'pending-03', code: 'POR VALIDAR', name: 'Red pendiente de validación 3', municipalities: 0, reports: '—', total: 0, status: 'Sin configurar', configured: false },
    { id: 'pending-04', code: 'POR VALIDAR', name: 'Red pendiente de validación 4', municipalities: 0, reports: '—', total: 0, status: 'Sin configurar', configured: false },
    { id: 'pending-05', code: 'POR VALIDAR', name: 'Red pendiente de validación 5', municipalities: 0, reports: '—', total: 0, status: 'Sin configurar', configured: false },
  ];

  protected readonly municipalities = [
    { code: '0506', name: 'Puerto Cortés', establishments: 12, total: 184, newCases: 139, controls: 45, reports: '9 / 12', associated: true },
    { code: '0503', name: 'Omoa', establishments: 6, total: 96, newCases: 72, controls: 24, reports: '6 / 6', associated: true },
    { code: '0501', name: 'San Pedro Sula', establishments: 0, total: 0, newCases: 0, controls: 0, reports: '—', associated: false },
    { code: '0502', name: 'Choloma', establishments: 0, total: 0, newCases: 0, controls: 0, reports: '—', associated: false },
    { code: '0504', name: 'La Lima', establishments: 0, total: 0, newCases: 0, controls: 0, reports: '—', associated: false },
  ];

  protected readonly classifications = [
    { name: 'Sindrómico', puertoCortes: 82, omoa: 41, total: 123 },
    { name: 'Clínico', puertoCortes: 48, omoa: 27, total: 75 },
    { name: 'C/E', puertoCortes: 21, omoa: 12, total: 33 },
    { name: 'Etiológico', puertoCortes: 33, omoa: 16, total: 49 },
  ];

  protected readonly history = [
    { date: '04 ago 2026 · 10:15', action: 'Red creada para el prototipo', user: 'Lic. Roberto Lagos', detail: 'Se registró la agrupación Puerto Cortés–Omoa con estado En pilotaje.' },
    { date: '04 ago 2026 · 10:18', action: 'Municipios asociados', user: 'Lic. Roberto Lagos', detail: 'Se asociaron Puerto Cortés y Omoa con vigencia desde julio 2026.' },
    { date: '04 ago 2026 · 10:32', action: 'Consolidado recalculado', user: 'Sistema', detail: 'Se generó la vista agregada de 280 casos ITS.' },
  ];

  get canManage() { return ['superadmin', 'regional-superadmin'].includes(this.roleContext.activeRoleId()); }
  get isGlobal() { return this.roleContext.activeRoleId() === 'superadmin'; }
  get selectedNetwork() { return this.networks.find(network => network.id === this.selectedNetworkId) ?? this.networks[0]; }
  get associatedMunicipalities() { return this.municipalities.filter(municipality => municipality.associated); }

  protected showCreateForm = false;
  protected formSubmitted = false;
  protected networkForm = this.emptyNetworkForm();

  protected openCreate() {
    this.formSubmitted = false;
    this.networkForm = this.emptyNetworkForm();
    this.showCreateForm = true;
  }

  protected closeCreate() { this.showCreateForm = false; }

  protected saveNetwork() {
    this.formSubmitted = true;
    const form = this.networkForm;
    if (!form.name.trim() || !form.code.trim() || !form.region) return;
    const selected = this.municipalities.filter(municipality => form.municipalityCodes.includes(municipality.code));
    const id = `${form.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    this.networks = [...this.networks, { id, code: form.code.trim(), name: form.name.trim(), municipalities: selected.length, reports: '—', total: 0, status: form.status, configured: true }];
    this.selectedNetworkId = id;
    this.showCreateForm = false;
    this.notify.emit(`Red “${form.name.trim()}” creada correctamente.`);
  }

  protected toggleMunicipality(code: string, checked: boolean) {
    this.networkForm.municipalityCodes = checked
      ? [...this.networkForm.municipalityCodes, code]
      : this.networkForm.municipalityCodes.filter(item => item !== code);
  }

  private emptyNetworkForm() {
    return { name: '', code: '', region: 'Región de Cortés', status: 'Preconfigurada', startDate: '2026-08-01', municipalityCodes: [] as string[] };
  }

  selectNetwork(id: string) {
    this.selectedNetworkId = id;
    this.activeTab = 'summary';
  }

  setNetwork(event: Event) { this.selectNetwork((event.target as HTMLSelectElement).value); }
  setMunicipality(event: Event) { this.municipalityFilter = (event.target as HTMLSelectElement).value; }
  selectTab(tab: NetworkTab) { this.activeTab = tab; }
}
