import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { EstablishmentContext } from '../../core/establishment-context';
import { RoleContext } from '../../core/role-context';
import { CaptureContextResponse, ItsCaptureApiService } from '../../core/its-capture-api.service';
import { EstablishmentSelector } from '../../shared/establishment-selector/establishment-selector';

@Component({
  selector: 'app-capture-its1',
  imports: [ReactiveFormsModule, EstablishmentSelector],
  templateUrl: './capture-its1.html',
  styleUrl: './capture-its1.css'
})
export class CaptureIts1 implements OnInit {
  readonly notify = output<string>();
  protected readonly context = inject(EstablishmentContext);
  protected readonly roleContext = inject(RoleContext);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ItsCaptureApiService);
  readonly contextLoading = signal(false);
  readonly saving = signal(false);
  readonly captureContext = signal<CaptureContextResponse | null>(null);
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

  ngOnInit() {
    if (this.auth.isDemo()) return;
    this.contextLoading.set(true);
    this.api.getContext().pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.contextLoading.set(false)),
    ).subscribe({
      next: context => {
        this.captureContext.set(context);
        this.context.replace(context.facilities.map(item => ({
          id: item.id, code: item.code, name: item.name,
          type: item.type === 'POLICLINICO' ? 'Policlínico' : item.type as 'CIS' | 'UAPS',
        })));
      },
      error: () => this.notify.emit('No fue posible cargar los catálogos autorizados.'),
    });
  }

  get diagnostics() { return this.form.controls.diagnostics as FormArray; }
  get canSelectEstablishment() { return this.roleContext.activeRoleId() === 'coordination-digitizer'; }
  get activeUser() { return this.roleContext.activeRole(); }
  get isCorrectionRequested() { return this.context.selectedCode() === '2771'; }
  get potentialDuplicate() { return (this.form.controls.patientId.value ?? '').trim().toUpperCase() === 'EXP-2026-01841'; }
  get weekPreview() { return this.calculateWeek(this.form.controls.attentionDate.value); }

  availableDiseases() {
    const sex = this.form.controls.sex.value;
    const configured = this.captureContext()?.classifications.flatMap(item => item.diseases) ?? [];
    if (configured.length) return configured.filter(item => sex === 'Hombre' ? item.appliesToMale : sex === 'Mujer' ? item.appliesToFemale : true).map(item => item.name);
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
    if (this.auth.isDemo()) {
      this.notify.emit(this.isCorrectionRequested ? 'Corrección ITS 1 guardada para revisión.' : 'Atención ITS 1 guardada en la demostración.');
      return;
    }
    const value = this.form.getRawValue();
    const context = this.captureContext();
    const facility = this.context.selected();
    const population = context?.populationTypes.find(item => item.name === value.populationType);
    const diagnoses = value.diagnostics.map(item => {
      const disease = context?.classifications.flatMap(group => group.diseases).find(candidate => candidate.name === item.disease);
      return disease ? { diseaseId: disease.id, caseType: item.caseType === 'Control' ? 'CONTROL' as const : 'NUEVO' as const } : null;
    });
    if (!facility.id || !population || diagnoses.some(item => !item) || value.age === null) {
      this.notify.emit('La configuración de captura está incompleta. Recargue los catálogos.');
      return;
    }
    this.saving.set(true);
    this.api.createAttention({
      facilityId: facility.id, attentionDate: value.attentionDate!, patientRecordNumber: value.patientId!,
      originText: value.procedence!, sex: value.sex === 'Mujer' ? 'M' : 'H', age: value.age,
      populationTypeId: population.id, isContact: value.contact === 'Sí', isPregnant: value.pregnant === 'Sí',
      observation: value.observations || undefined, diagnoses: diagnoses.filter(item => item !== null),
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: result => this.notify.emit(result.possibleDuplicate ? 'Atención guardada con alerta de posible duplicado.' : 'Atención ITS 1 guardada correctamente.'),
      error: error => this.notify.emit(error?.error?.detail ?? 'No fue posible guardar la atención ITS 1.'),
    });
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
