import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoleContext } from '../../core/role-context';

type ComparisonDimension = 'periods' | 'territories' | 'indicators';
interface AnnualEvaluationConfig {
  reportType: string; dimension: ComparisonDimension;
  rangeAStart: string; rangeAEnd: string; rangeBStart: string; rangeBEnd: string;
  territoryA: string; territoryB: string; indicatorA: string; indicatorB: string; format: string;
}

@Component({ selector: 'app-exports', imports: [FormsModule], templateUrl: './exports.html', styleUrl: './exports.css' })
export class Exports {
  readonly notify = output<string>();
  private readonly roleContext = inject(RoleContext);
  protected showAnnualEvaluation = false;
  protected formSubmitted = false;

  protected readonly dimensions: { value: ComparisonDimension; label: string; detail: string }[] = [
    { value: 'periods', label: 'Períodos de tiempo', detail: 'Contrastar dos rangos del mismo alcance.' },
    { value: 'territories', label: 'Territorios', detail: 'Contrastar dos territorios autorizados.' },
    { value: 'indicators', label: 'Indicadores', detail: 'Contrastar dos indicadores en el mismo rango.' },
  ];
  protected readonly indicators = ['Total de casos ITS', 'Casos nuevos', 'Controles', 'Tasa ITS por 1,000 atenciones', 'Casos en menores de 15 años', 'Casos en mayores de 15 años'];
  protected annualForm = this.emptyAnnualForm();
  protected annualPreview: AnnualEvaluationConfig | null = null;

  protected get territoryOptions() {
    switch (this.roleContext.activeRoleId()) {
      case 'superadmin':
      case 'central-validator': return ['Honduras', 'Región de Cortés', 'Región de Atlántida', 'Región de Francisco Morazán'];
      case 'regional-superadmin':
      case 'regional-admin': return ['Región de Cortés', 'Puerto Cortés', 'Omoa', 'San Pedro Sula', 'Choloma'];
      case 'municipal-coordinator': return ['Puerto Cortés', 'Policlínico Cornelio Moncada', 'CIS Linda Coello', 'UAPS La Pita', 'CIS Bajamar'];
      case 'supervisor': return ['Región de Cortés', 'Puerto Cortés', 'Red Puerto Cortés–Omoa'];
      default: return ['CIS Linda Coello'];
    }
  }

  protected get canCompareTerritories() { return this.territoryOptions.length > 1; }
  protected get invalidRanges() {
    const form = this.annualForm;
    return !form.rangeAStart || !form.rangeAEnd || !form.rangeBStart || !form.rangeBEnd || form.rangeAStart > form.rangeAEnd || form.rangeBStart > form.rangeBEnd;
  }

  protected openAnnualEvaluation() {
    this.annualForm = this.annualPreview ? { ...this.annualPreview } : this.emptyAnnualForm();
    if (!this.annualForm.territoryA) this.annualForm.territoryA = this.territoryOptions[0];
    if (!this.annualForm.territoryB) this.annualForm.territoryB = this.territoryOptions[1] ?? this.territoryOptions[0];
    this.formSubmitted = false;
    this.showAnnualEvaluation = true;
  }

  protected closeAnnualEvaluation() { this.showAnnualEvaluation = false; }

  protected setDimension(dimension: ComparisonDimension) {
    if (dimension === 'territories' && !this.canCompareTerritories) return;
    this.annualForm.dimension = dimension;
  }

  protected generateAnnualEvaluation() {
    this.formSubmitted = true;
    if (this.invalidRanges) return;
    const dimension = this.dimensions.find(item => item.value === this.annualForm.dimension)?.label ?? 'Períodos';
    this.annualPreview = { ...this.annualForm };
    this.showAnnualEvaluation = false;
    this.notify.emit(`Evaluación anual configurada: comparación por ${dimension.toLowerCase()}.`);
  }

  protected formatRange(start: string, end: string) {
    const formatter = new Intl.DateTimeFormat('es-HN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const date = (value: string) => formatter.format(new Date(`${value}-01T00:00:00Z`)).replace('.', '');
    return `${date(start)} – ${date(end)}`;
  }

  private emptyAnnualForm(): AnnualEvaluationConfig {
    return {
      reportType: 'Comparativo anual', dimension: 'periods' as ComparisonDimension,
      rangeAStart: '2025-01', rangeAEnd: '2025-12', rangeBStart: '2026-01', rangeBEnd: '2026-12',
      territoryA: '', territoryB: '', indicatorA: this.indicators[0], indicatorB: this.indicators[3], format: 'Vista previa',
    };
  }
}
