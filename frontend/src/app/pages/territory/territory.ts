import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoleContext } from '../../core/role-context';

type TerritoryTab = 'general' | 'geography' | 'responsibles' | 'history';
type CreateTerritoryKind = 'region' | 'municipality' | 'establishment';

@Component({ selector: 'app-territory', imports: [FormsModule], templateUrl: './territory.html', styleUrl: './territory.css' })
export class Territory {
  readonly notify = output<string>();
  protected readonly roleContext = inject(RoleContext);
  protected activeTab: TerritoryTab = 'general';
  protected readonly tabs: { id: TerritoryTab; label: string }[] = [
    { id: 'general', label: 'Información general' },
    { id: 'geography', label: 'Geografía' },
    { id: 'responsibles', label: 'Responsables' },
    { id: 'history', label: 'Historial' },
  ];
  protected readonly responsibles = [
    { initials: 'AM', name: 'Dra. Ana Martínez', role: 'Coordinadora Municipal', scope: 'Puerto Cortés', status: 'Activo', since: '12 ene 2026' },
    { initials: 'ML', name: 'María López', role: 'Digitadora de Coordinación', scope: '12 establecimientos', status: 'Activo', since: '03 feb 2026' },
    { initials: 'RL', name: 'Lic. Roberto Lagos', role: 'SuperAdmin Regional', scope: 'Región de Cortés', status: 'Supervisión', since: '08 ene 2026' },
  ];
  protected readonly history = [
    { date: '04 ago 2026 · 09:22', user: 'Lic. Roberto Lagos', action: 'Actualizó catálogo de establecimientos', detail: 'Se registraron los 12 establecimientos oficiales de Puerto Cortés.', tone: 'green' },
    { date: '03 ago 2026 · 15:40', user: 'Dra. Ana Martínez', action: 'Validó información municipal', detail: 'Confirmó el código 0506 y la dependencia regional.', tone: 'blue' },
    { date: '02 ago 2026 · 11:18', user: 'Carlos Mejía', action: 'Activó coordinación en pilotaje', detail: 'Puerto Cortés quedó disponible para operación supervisada.', tone: 'purple' },
    { date: '01 ago 2026 · 08:05', user: 'Sistema', action: 'Registró geometría municipal', detail: 'La silueta geográfica se vinculó al catálogo territorial.', tone: 'gray' },
  ];
  protected regions = [
    { code: '05', name: 'Región Sanitaria Departamental de Cortés', municipalities: 12, activeMunicipalities: 1, establishments: 12, status: 'Activa' },
    { code: '01', name: 'Región Sanitaria de Atlántida', municipalities: 8, activeMunicipalities: 0, establishments: 0, status: 'Preconfigurada' },
    { code: '08', name: 'Región Sanitaria de Francisco Morazán', municipalities: 28, activeMunicipalities: 0, establishments: 0, status: 'Preconfigurada' },
  ];
  protected municipalities = [
    { code: '0506', name: 'Puerto Cortés', region: 'Cortés', establishments: 12, responsible: 'Dra. Ana Martínez', status: 'En pilotaje' },
    { code: '0501', name: 'San Pedro Sula', region: 'Cortés', establishments: 0, responsible: 'Sin asignar', status: 'Preconfigurado' },
    { code: '0502', name: 'Choloma', region: 'Cortés', establishments: 0, responsible: 'Sin asignar', status: 'Preconfigurado' },
  ];
  protected establishmentNames = ['Policlínico Cornelio Moncada', 'CIS Linda Coello', 'UAPS La Pita', 'CIS Bajamar'];
  get regionalScope() { return this.roleContext.activeRoleId() === 'regional-superadmin'; }
  get globalScope() { return this.roleContext.activeRoleId() === 'superadmin'; }

  protected createKind: CreateTerritoryKind | null = null;
  protected formSubmitted = false;
  protected territoryForm = this.emptyForm();

  protected get createTitle() {
    return this.createKind === 'region' ? 'Nueva región sanitaria' : this.createKind === 'municipality' ? 'Nuevo municipio' : 'Nuevo establecimiento';
  }

  openCreate(kind: CreateTerritoryKind) {
    if (kind === 'region' && !this.globalScope) return;
    this.createKind = kind;
    this.formSubmitted = false;
    this.territoryForm = this.emptyForm();
    if (kind === 'region') this.territoryForm.status = 'Preconfigurada';
  }

  protected closeCreate() {
    this.createKind = null;
    this.formSubmitted = false;
  }

  protected saveTerritory() {
    this.formSubmitted = true;
    const form = this.territoryForm;
    if (!form.name.trim() || !form.code.trim()) return;
    if (this.createKind === 'region') {
      this.regions = [...this.regions, { code: form.code.trim(), name: form.name.trim(), municipalities: 0, activeMunicipalities: 0, establishments: 0, status: form.status }];
    } else if (this.createKind === 'municipality') {
      this.municipalities = [...this.municipalities, { code: form.code.trim(), name: form.name.trim(), region: form.region, establishments: 0, responsible: form.responsible.trim() || 'Sin asignar', status: form.status }];
    } else if (this.createKind === 'establishment') {
      this.establishmentNames = [...this.establishmentNames, form.name.trim()];
      this.municipalities = this.municipalities.map(municipality => municipality.name === form.municipality
        ? { ...municipality, establishments: municipality.establishments + 1 }
        : municipality);
    }
    const label = this.createKind === 'region' ? 'Región' : this.createKind === 'municipality' ? 'Municipio' : 'Establecimiento';
    this.closeCreate();
    this.notify.emit(`${label} “${form.name.trim()}” creado correctamente.`);
  }

  private emptyForm() {
    return { name: '', code: '', region: 'Cortés', municipality: 'Puerto Cortés', type: 'CIS', responsible: '', status: 'Preconfigurado', address: '' };
  }

  selectTab(tab: TerritoryTab) { this.activeTab = tab; }
}
