import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { EstablishmentContext } from '../../core/establishment-context';
import { RoleContext } from '../../core/role-context';
import { CaptureContextResponse, CreateAttentionRequest, ItsAttentionRecord, ItsCaptureApiService } from '../../core/its-capture-api.service';
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
  readonly recordsLoading = signal(false);
  readonly records = signal<ItsAttentionRecord[]>([]);
  readonly editing = signal<ItsAttentionRecord | null>(null);
  readonly cancelling = signal<ItsAttentionRecord | null>(null);
  readonly cancelReason = signal('');
  readonly captureContext = signal<CaptureContextResponse | null>(null);
  submitted = false;

  readonly form = this.formBuilder.group({
    attentionDate: [new Date().toISOString().slice(0, 10), Validators.required],
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
    this.form.controls.attentionDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadRecords());
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
        this.loadRecords();
      },
      error: () => this.notify.emit('No fue posible cargar los catálogos autorizados.'),
    });
  }

  get diagnostics() { return this.form.controls.diagnostics as FormArray; }
  get demoMode() { return this.auth.isDemo(); }
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

  selectRecord(record: ItsAttentionRecord) {
    const context = this.captureContext();
    if (!context) return;
    this.editing.set(record);
    this.form.patchValue({
      attentionDate: record.attentionDate.slice(0, 10),
      patientId: record.patientRecordNumber,
      procedence: record.originText,
      sex: record.sex === 'M' ? 'Mujer' : 'Hombre',
      age: record.age,
      populationType: record.populationType.name,
      contact: record.isContact ? 'Sí' : 'No',
      pregnant: record.isPregnant ? 'Sí' : 'No',
      observations: record.observation ?? '',
    });
    this.diagnostics.clear();
    for (const diagnosis of record.diagnoses) {
      const classification = context.classifications.find(group =>
        group.diseases.some(disease => disease.id === diagnosis.diseaseId));
      this.diagnostics.push(this.formBuilder.group({
        classification: [classification?.name ?? '', Validators.required],
        disease: [diagnosis.diseaseName, Validators.required],
        caseType: [diagnosis.caseType === 'CONTROL' ? 'Control' : 'Nuevo', Validators.required],
      }));
    }
    if (!this.diagnostics.length) this.diagnostics.push(this.createDiagnostic());
  }

  clearForm() {
    this.editing.set(null);
    this.submitted = false;
    this.form.reset({
      attentionDate: new Date().toISOString().slice(0, 10),
      patientId: '', procedence: '', sex: '', age: null, populationType: 'General',
      contact: '', pregnant: 'No', observations: '',
    });
    this.form.controls.pregnant.disable({ emitEvent: false });
    this.diagnostics.clear();
    this.diagnostics.push(this.createDiagnostic());
  }

  openCancel() {
    const record = this.editing();
    if (!record) return;
    this.cancelReason.set('');
    this.cancelling.set(record);
  }

  closeCancel() {
    this.cancelling.set(null);
    this.cancelReason.set('');
  }

  confirmCancel() {
    const record = this.cancelling();
    const reason = this.cancelReason().trim();
    if (!record || reason.length < 10 || this.saving()) return;
    this.saving.set(true);
    this.api.cancelAttention(record.id, record.facilityId, record.updatedAt, reason).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.records.update(records => records.filter(item => item.id !== record.id));
        this.closeCancel();
        this.clearForm();
        this.notify.emit('Atención ITS 1 anulada y registrada en auditoría.');
      },
      error: error => this.notify.emit(error?.error?.detail ?? 'No fue posible anular la atención ITS 1.'),
    });
  }

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
    const request: CreateAttentionRequest = {
      facilityId: facility.id, attentionDate: value.attentionDate!, patientRecordNumber: value.patientId!,
      originText: value.procedence!, sex: value.sex === 'Mujer' ? 'M' : 'H', age: value.age,
      populationTypeId: population.id, isContact: value.contact === 'Sí', isPregnant: value.pregnant === 'Sí',
      observation: value.observations || undefined, diagnoses: diagnoses.filter(item => item !== null),
    };
    const editing = this.editing();
    const operation = editing
      ? this.api.updateAttention({ ...request, id: editing.id, expectedUpdatedAt: editing.updatedAt })
      : this.api.createAttention(request);
    this.saving.set(true);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: result => {
        this.notify.emit(editing
          ? 'Corrección ITS 1 guardada y auditada.'
          : result.possibleDuplicate ? 'Atención guardada con alerta de posible duplicado.' : 'Atención ITS 1 guardada correctamente.');
        this.clearForm();
        this.loadRecords();
      },
      error: error => this.notify.emit(error?.error?.detail ?? 'No fue posible guardar la atención ITS 1.'),
    });
  }

  loadRecords() {
    if (this.auth.isDemo()) return;
    const facilityId = this.context.selected().id;
    const date = this.form.controls.attentionDate.value;
    if (!facilityId || !date) return;
    const [year, month] = date.split('-').map(Number);
    this.recordsLoading.set(true);
    this.api.listAttentions(facilityId, year, month).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.recordsLoading.set(false)),
    ).subscribe({
      next: page => this.records.set(page.items),
      error: () => this.notify.emit('No fue posible cargar las atenciones del período.'),
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
