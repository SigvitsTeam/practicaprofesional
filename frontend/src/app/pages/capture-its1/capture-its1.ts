import { Component, DestroyRef, inject, output } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EstablishmentContext } from '../../core/establishment-context';
import { EstablishmentSelector } from '../../shared/establishment-selector/establishment-selector';

@Component({
  selector: 'app-capture-its1',
  imports: [ReactiveFormsModule, EstablishmentSelector],
  templateUrl: './capture-its1.html',
  styleUrl: './capture-its1.css'
})
export class CaptureIts1 {
  readonly notify = output<string>();
  protected readonly context = inject(EstablishmentContext);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  submitted = false;

  readonly form = this.formBuilder.group({
    attentionDate: ['2026-07-28', Validators.required],
    patientId: ['', [Validators.required, Validators.minLength(4)]],
    procedence: ['', [Validators.required, Validators.minLength(3)]],
    sex: ['', Validators.required],
    age: [null as number | null, [Validators.required, Validators.min(0), Validators.max(120)]],
    populationType: ['General', Validators.required],
    contact: ['', Validators.required],
    pregnant: [{ value: 'No', disabled: true }, Validators.required],
    observations: [''],
    diagnostics: this.formBuilder.array([this.createDiagnostic()]),
  });

  readonly recentRecords = [
    { id: 'EXP-2026-01841', date: '28 jul', diagnosis: 'Úlcera genital', status: 'Guardado' },
    { id: 'EXP-2026-01840', date: '28 jul', diagnosis: 'Secreción uretral', status: 'Guardado' },
    { id: 'EXP-2026-01839', date: '27 jul', diagnosis: 'Condiloma acuminado', status: 'Corregido' },
  ];

  constructor() {
    this.form.controls.sex.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sex => {
      if (sex === 'Mujer') this.form.controls.pregnant.enable({ emitEvent: false });
      else {
        this.form.controls.pregnant.setValue('No', { emitEvent: false });
        this.form.controls.pregnant.disable({ emitEvent: false });
      }
    });
  }

  get diagnostics() { return this.form.controls.diagnostics as FormArray; }
  get isCorrectionRequested() { return this.context.selectedCode() === 'UAPS-004'; }
  get potentialDuplicate() { return (this.form.controls.patientId.value ?? '').trim().toUpperCase() === 'EXP-2026-01841'; }
  get weekPreview() { return this.calculateWeek(this.form.controls.attentionDate.value); }

  availableDiseases() {
    const sex = this.form.controls.sex.value;
    const common = ['Úlcera genital', 'Condiloma acuminado', 'Sífilis', 'Herpes genital'];
    if (sex === 'Hombre') return ['Síndrome de secreción uretral', ...common];
    if (sex === 'Mujer') return ['Vaginitis', 'Flujo vaginal', ...common];
    return ['Síndrome de secreción uretral', 'Vaginitis', 'Flujo vaginal', ...common];
  }

  addDiagnostic() { this.diagnostics.push(this.createDiagnostic()); }
  removeDiagnostic(index: number) { if (this.diagnostics.length > 1) this.diagnostics.removeAt(index); }

  save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.notify.emit('Revise los campos obligatorios antes de guardar.');
      return;
    }
    this.notify.emit(this.isCorrectionRequested ? 'Corrección ITS 1 guardada para revisión.' : 'Atención ITS 1 guardada en la demostración.');
  }

  private createDiagnostic() {
    return this.formBuilder.group({
      classification: ['Sindrómico', Validators.required],
      disease: ['', Validators.required],
      caseType: ['Nuevo', Validators.required],
    });
  }

  private calculateWeek(value: string | null) {
    if (!value) return '—';
    const date = new Date(`${value}T12:00:00`);
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return `SE ${Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)}`;
  }
}
