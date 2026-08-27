import { Component, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { hondurasTodayIso } from '../../core/honduras-date';
import { EstablishmentContext } from '../../core/establishment-context';
import { RoleContext } from '../../core/role-context';
import {
  CaptureContextResponse,
  CreateAttentionRequest,
  ItsAttentionRecord,
  ItsCaptureApiService,
} from '../../core/its-capture-api.service';
import { EstablishmentSelector } from '../../shared/establishment-selector/establishment-selector';
import { diseasesApplicableToSex, isDiseaseApplicableToSex } from './disease-applicability';

const DEMO_CLASSIFICATIONS: CaptureContextResponse['classifications'] = [
  {
    id: 'demo-sindromico',
    code: 'SINDROMICO',
    name: 'Sindrómico',
    diseases: [
      { id: 'demo-01', name: 'Flujo uretral', appliesToMale: true, appliesToFemale: false },
      { id: 'demo-02', name: 'Cervicitis', appliesToMale: false, appliesToFemale: true },
      { id: 'demo-03', name: 'Vaginitis', appliesToMale: false, appliesToFemale: true },
      { id: 'demo-04', name: 'Úlcera genital', appliesToMale: true, appliesToFemale: true },
      { id: 'demo-05', name: 'EPI', appliesToMale: false, appliesToFemale: true },
      { id: 'demo-06', name: 'Bubón inguinal', appliesToMale: true, appliesToFemale: true },
    ],
  },
  {
    id: 'demo-clinico',
    code: 'CLINICO',
    name: 'Clínico',
    diseases: [
      { id: 'demo-07', name: 'Molusco contagioso', appliesToMale: true, appliesToFemale: true },
      { id: 'demo-08', name: 'Granuloma inguinal', appliesToMale: true, appliesToFemale: true },
      { id: 'demo-09', name: 'Condiloma acuminado', appliesToMale: true, appliesToFemale: true },
    ],
  },
  {
    id: 'demo-ce',
    code: 'CE',
    name: 'C/E',
    diseases: [
      { id: 'demo-10', name: 'Vaginosis bacteriana', appliesToMale: false, appliesToFemale: true },
      { id: 'demo-11', name: 'Sífilis congénita', appliesToMale: true, appliesToFemale: true },
    ],
  },
  {
    id: 'demo-etiologico',
    code: 'ETIOLOGICO',
    name: 'Etiológico',
    diseases: [
      { id: 'demo-12', name: 'Sífilis', appliesToMale: true, appliesToFemale: true },
      {
        id: 'demo-13',
        name: 'Chlamydia trachomatis',
        appliesToMale: true,
        appliesToFemale: true,
      },
      { id: 'demo-14', name: 'Trichomonas', appliesToMale: true, appliesToFemale: true },
      { id: 'demo-15', name: 'Cándida albicans', appliesToMale: true, appliesToFemale: true },
      {
        id: 'demo-16',
        name: 'Neisseria gonorrhoeae',
        appliesToMale: true,
        appliesToFemale: true,
      },
      { id: 'demo-17', name: 'Herpes genital', appliesToMale: true, appliesToFemale: true },
      { id: 'demo-18', name: 'Hepatitis B', appliesToMale: true, appliesToFemale: true },
    ],
  },
];

@Component({
  selector: 'app-capture-its1',
  imports: [ReactiveFormsModule, EstablishmentSelector],
  templateUrl: './capture-its1.html',
  styleUrl: './capture-its1.css',
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
    attentionDate: [hondurasTodayIso(), Validators.required],
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
    this.form.controls.sex.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sex) => {
        if (sex === 'Mujer') this.form.controls.pregnant.enable({ emitEvent: false });
        else {
          this.form.controls.pregnant.setValue('No', { emitEvent: false });
          this.form.controls.pregnant.disable({ emitEvent: false });
        }
        this.reconcileDiagnosticsWithSex();
      });
    this.form.controls.attentionDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadRecords());
  }

  ngOnInit() {
    if (this.auth.isDemo()) return;
    this.context.replace([{ code: '', name: 'Cargando establecimiento…', type: 'CIS' }]);
    this.contextLoading.set(true);
    this.api
      .getContext()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.contextLoading.set(false)),
      )
      .subscribe({
        next: (context) => {
          this.captureContext.set(context);
          this.context.replace(
            context.facilities.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              type: item.type === 'POLICLINICO' ? 'Policlínico' : (item.type as 'CIS' | 'UAPS'),
            })),
          );
          this.loadRecords();
        },
        error: () => {
          this.context.replace([{ code: '', name: 'Establecimiento no disponible', type: 'CIS' }]);
          this.notify.emit('No fue posible cargar los catálogos autorizados.');
        },
      });
  }

  get diagnostics() {
    return this.form.controls.diagnostics as FormArray;
  }
  get demoMode() {
    return this.auth.isDemo();
  }
  get canSelectEstablishment() {
    return this.roleContext.activeRoleId() === 'coordination-digitizer';
  }
  get activeUser() {
    return this.roleContext.activeRole();
  }
  get currentUserName() {
    return this.auth.isDemo()
      ? this.activeUser.userName
      : (this.auth.user()?.name ?? 'Usuario autenticado');
  }
  get selectedFacility() {
    const selected = this.context.selected();
    return this.captureContext()?.facilities.find(
      (item) => item.id === selected?.id || item.code === selected?.code,
    );
  }
  get currentRegionName() {
    return (
      this.selectedFacility?.region.name ?? (this.demoMode ? 'Región Sanitaria de Cortés' : '—')
    );
  }
  get currentMunicipalityName() {
    return this.selectedFacility?.municipality.name ?? (this.demoMode ? 'Puerto Cortés' : '—');
  }
  get activePeriod() {
    const value = this.form.controls.attentionDate.value;
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-HN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  }
  get isCorrectionRequested() {
    return this.demoMode && this.context.selectedCode() === '2771';
  }
  get potentialDuplicate() {
    return (
      this.demoMode &&
      (this.form.controls.patientId.value ?? '').trim().toUpperCase() === 'EXP-2026-01841'
    );
  }
  get weekPreview() {
    return this.calculateWeek(this.form.controls.attentionDate.value);
  }

  availableClassifications() {
    const sex = this.form.controls.sex.value;
    return this.classifications().filter(
      (classification) => diseasesApplicableToSex(classification.diseases, sex).length > 0,
    );
  }

  availableDiseases(index: number) {
    const diagnostic = this.diagnostics.at(index);
    const classificationId = diagnostic.get('classificationId')?.value;
    const classification = this.classifications().find((item) => item.id === classificationId);
    return diseasesApplicableToSex(classification?.diseases ?? [], this.form.controls.sex.value);
  }

  onClassificationChange(index: number) {
    this.diagnostics.at(index).get('diseaseId')?.setValue('');
  }

  addDiagnostic() {
    this.diagnostics.push(this.createDiagnostic());
  }
  removeDiagnostic(index: number) {
    if (this.diagnostics.length > 1) this.diagnostics.removeAt(index);
  }

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
      const classification = context.classifications.find((group) =>
        group.diseases.some((disease) => disease.id === diagnosis.diseaseId),
      );
      this.diagnostics.push(
        this.formBuilder.group({
          classificationId: [classification?.id ?? '', Validators.required],
          diseaseId: [diagnosis.diseaseId, Validators.required],
          caseType: [diagnosis.caseType === 'CONTROL' ? 'Control' : 'Nuevo', Validators.required],
        }),
      );
    }
    if (!this.diagnostics.length) this.diagnostics.push(this.createDiagnostic());
    this.reconcileDiagnosticsWithSex();
  }

  clearForm() {
    this.editing.set(null);
    this.submitted = false;
    this.form.reset({
      attentionDate: hondurasTodayIso(),
      patientId: '',
      procedence: '',
      sex: '',
      age: null,
      populationType: 'General',
      contact: '',
      pregnant: 'No',
      observations: '',
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
    this.api
      .cancelAttention(record.id, record.facilityId, record.updatedAt, reason)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.records.update((records) => records.filter((item) => item.id !== record.id));
          this.closeCancel();
          this.clearForm();
          this.notify.emit('Atención ITS 1 anulada y registrada en auditoría.');
        },
        error: (error) =>
          this.notify.emit(error?.error?.detail ?? 'No fue posible anular la atención ITS 1.'),
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
      this.notify.emit(
        this.isCorrectionRequested
          ? 'Corrección ITS 1 guardada para revisión.'
          : 'Atención ITS 1 guardada en la demostración.',
      );
      return;
    }
    const value = this.form.getRawValue();
    const context = this.captureContext();
    const facility = this.context.selected();
    const population = context?.populationTypes.find((item) => item.name === value.populationType);
    const diagnoses = value.diagnostics.map((item) => {
      const classification = this.classifications().find(
        (candidate) => candidate.id === item.classificationId,
      );
      const disease = classification?.diseases.find(
        (candidate) =>
          candidate.id === item.diseaseId &&
          isDiseaseApplicableToSex(candidate, this.form.controls.sex.value),
      );
      return disease
        ? {
            diseaseId: disease.id,
            caseType: item.caseType === 'Control' ? ('CONTROL' as const) : ('NUEVO' as const),
          }
        : null;
    });
    if (!facility.id || !population || diagnoses.some((item) => !item) || value.age === null) {
      this.notify.emit('La configuración de captura está incompleta. Recargue los catálogos.');
      return;
    }
    const request: CreateAttentionRequest = {
      facilityId: facility.id,
      attentionDate: value.attentionDate!,
      patientRecordNumber: value.patientId!,
      originText: value.procedence!,
      sex: value.sex === 'Mujer' ? 'M' : 'H',
      age: value.age,
      populationTypeId: population.id,
      isContact: value.contact === 'Sí',
      isPregnant: value.pregnant === 'Sí',
      observation: value.observations || undefined,
      diagnoses: diagnoses.filter((item) => item !== null),
    };
    const editing = this.editing();
    const operation = editing
      ? this.api.updateAttention({
          ...request,
          id: editing.id,
          expectedUpdatedAt: editing.updatedAt,
        })
      : this.api.createAttention(request);
    this.saving.set(true);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (result) => {
        this.notify.emit(
          editing
            ? 'Corrección ITS 1 guardada y auditada.'
            : result.possibleDuplicate
              ? 'Atención guardada con alerta de posible duplicado.'
              : 'Atención ITS 1 guardada correctamente.',
        );
        this.clearForm();
        this.loadRecords();
      },
      error: (error) =>
        this.notify.emit(error?.error?.detail ?? 'No fue posible guardar la atención ITS 1.'),
    });
  }

  loadRecords() {
    if (this.auth.isDemo()) return;
    const facilityId = this.context.selected().id;
    const date = this.form.controls.attentionDate.value;
    if (!facilityId || !date) return;
    const [year, month] = date.split('-').map(Number);
    this.recordsLoading.set(true);
    this.api
      .listAttentions(facilityId, year, month)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.recordsLoading.set(false)),
      )
      .subscribe({
        next: (page) => this.records.set(page.items),
        error: () => this.notify.emit('No fue posible cargar las atenciones del período.'),
      });
  }

  private createDiagnostic() {
    return this.formBuilder.group({
      classificationId: ['', Validators.required],
      diseaseId: ['', Validators.required],
      caseType: ['Nuevo', Validators.required],
    });
  }

  private classifications() {
    return this.captureContext()?.classifications ?? (this.demoMode ? DEMO_CLASSIFICATIONS : []);
  }

  private reconcileDiagnosticsWithSex() {
    const availableClassificationIds = new Set(
      this.availableClassifications().map((item) => item.id),
    );
    for (let index = 0; index < this.diagnostics.length; index += 1) {
      const diagnostic = this.diagnostics.at(index);
      const classificationId = diagnostic.get('classificationId')?.value;
      if (!classificationId || !availableClassificationIds.has(classificationId)) {
        diagnostic.patchValue({ classificationId: '', diseaseId: '' });
        continue;
      }
      const diseaseId = diagnostic.get('diseaseId')?.value;
      if (!this.availableDiseases(index).some((disease) => disease.id === diseaseId))
        diagnostic.get('diseaseId')?.setValue('');
    }
  }

  private calculateWeek(value: string | null) {
    if (!value) return '—';
    const date = new Date(`${value}T12:00:00`);
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return `SE ${Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
  }
}
