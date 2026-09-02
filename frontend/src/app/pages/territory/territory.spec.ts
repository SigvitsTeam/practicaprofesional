import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { RoleContext } from '../../core/role-context';
import {
  TerritorialApiService,
  type RegionRecord,
  type TerritorialCatalog,
} from '../../core/territorial-api.service';
import { UserAdminApiService, type ManagedUserRecord } from '../../core/user-admin-api.service';
import { Territory } from './territory';

const regions: RegionRecord[] = [
  {
    id: 'region-1',
    code: '05',
    name: 'Cortés',
    type: 'DEPARTAMENTAL',
    operationalStatus: 'ACTIVO',
    active: true,
    updatedAt: '2026-09-02T12:00:00Z',
  },
  {
    id: 'region-inactive',
    code: '99',
    name: 'Región inactiva',
    type: 'DEPARTAMENTAL',
    operationalStatus: 'INACTIVO',
    active: false,
    updatedAt: '2026-09-02T12:00:00Z',
  },
];
const catalog: TerritorialCatalog = {
  municipalities: [
    {
      id: 'municipality-1',
      regionId: 'region-1',
      regionName: 'Cortés',
      officialCode: '0501',
      name: 'Municipio QA',
      operationalStatus: 'ACTIVO',
      mapValidated: false,
      active: true,
      facilityCount: 2,
      updatedAt: '2026-09-02T12:00:00Z',
    },
  ],
  facilities: [
    {
      id: 'facility-1',
      municipalityId: 'municipality-1',
      municipalityName: 'Municipio QA',
      code: 'F1',
      name: 'Centro QA',
      type: 'CIS',
      operationalStatus: 'ACTIVO',
      coordinatesValidated: false,
      active: true,
      updatedAt: '2026-09-02T12:00:00Z',
    },
    {
      id: 'facility-inactive',
      municipalityId: 'municipality-1',
      municipalityName: 'Municipio QA',
      code: 'F2',
      name: 'Centro inactivo',
      type: 'CIS',
      operationalStatus: 'INACTIVO',
      coordinatesValidated: false,
      active: false,
      updatedAt: '2026-09-02T12:00:00Z',
    },
  ],
};

describe('Territory user role and scope form', () => {
  let fixture: ComponentFixture<Territory>;
  let host: HTMLElement;
  let create: ReturnType<typeof vi.fn>;
  let changeAccess: ReturnType<typeof vi.fn>;
  let users: ManagedUserRecord[];

  beforeEach(async () => {
    users = [];
    create = vi.fn(() => new Subject<ManagedUserRecord>());
    changeAccess = vi.fn(() => new Subject<ManagedUserRecord>());
    await TestBed.configureTestingModule({
      imports: [Territory],
      providers: [
        {
          provide: TerritorialApiService,
          useValue: {
            listRegions: () => of(regions),
            listCatalog: () => of(catalog),
            listMunicipalityAudit: () => of({ items: [] }),
          },
        },
        { provide: UserAdminApiService, useValue: { list: () => of(users), create, changeAccess } },
      ],
    }).compileComponents();
    TestBed.inject(RoleContext).select('superadmin');
  });

  async function render() {
    fixture = TestBed.createComponent(Territory);
    host = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function clickButton(label: string) {
    const button = Array.from(host.querySelectorAll('button')).find((item) =>
      item.textContent?.includes(label),
    );
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function select(name: string) {
    const element = host.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
    expect(element).not.toBeNull();
    return element!;
  }

  async function choose(name: string, value: string) {
    const element = select(name);
    element.value = value;
    element.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function options(name: string) {
    return Array.from(select(name).options)
      .map((option) => option.value)
      .filter(Boolean);
  }

  async function completeDetails() {
    for (const [name, value] of [
      ['userName', 'Persona de prueba'],
      ['userEmail', 'qa@example.org'],
      ['userReason', 'Alta autorizada para prueba local'],
    ]) {
      const element = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`,
      )!;
      element.value = value;
      element.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it.each([
    ['ADMIN_CENTRAL', 'NACIONAL'],
    ['SUPERADMIN_REGIONAL', 'REGION'],
    ['ADMIN_REGIONAL', 'REGION'],
    ['COORDINADOR_MUNICIPAL', 'MUNICIPIO'],
    ['DIGITADOR_COORDINACION', 'ESTABLECIMIENTO'],
    ['RESPONSABLE_ESTABLECIMIENTO', 'ESTABLECIMIENTO'],
  ])('limits %s to %s immediately through the rendered select', async (role, scope) => {
    await render();
    await clickButton('Nuevo usuario');
    await choose('userRole', role);
    expect(select('userScope').value).toBe(scope);
    expect(options('userScope')).toEqual([scope]);
    expect(select('userScope').disabled).toBe(true);
  });

  it('removes national scope when switching to supervisor', async () => {
    await render();
    await clickButton('Nuevo usuario');
    await choose('userRole', 'ADMIN_CENTRAL');
    await choose('userRole', 'SUPERVISOR_CONSULTA');
    expect(options('userScope')).toEqual(['REGION', 'MUNICIPIO', 'ESTABLECIMIENTO']);
    expect(select('userScope').value).toBe('REGION');
    expect(select('userScope').disabled).toBe(false);
  });

  it('clears the selected territory and updates its label when changing role', async () => {
    await render();
    await clickButton('Nuevo usuario');
    await choose('userTarget', 'region-1');
    await choose('userRole', 'COORDINADOR_MUNICIPAL');
    expect(select('userTarget').value).toBe('');
    expect(select('userTarget').closest('label')?.textContent).toContain('Municipio asignado');
    expect(options('userTarget')).toEqual(['municipality-1']);
  });

  it('only offers active targets returned by the scoped catalog', async () => {
    await render();
    await clickButton('Nuevo usuario');
    expect(options('userTarget')).toEqual(['region-1']);
    await choose('userRole', 'RESPONSABLE_ESTABLECIMIENTO');
    expect(options('userTarget')).toEqual(['facility-1']);
  });

  it('clears the previous target when the supervisor changes scope', async () => {
    await render();
    await clickButton('Nuevo usuario');
    await choose('userRole', 'SUPERVISOR_CONSULTA');
    await choose('userTarget', 'region-1');
    await choose('userScope', 'MUNICIPIO');
    expect(select('userTarget').value).toBe('');
    expect(options('userTarget')).toEqual(['municipality-1']);
    await choose('userTarget', 'municipality-1');
    await choose('userScope', 'ESTABLECIMIENTO');
    expect(select('userTarget').value).toBe('');
    expect(options('userTarget')).toEqual(['facility-1']);
  });

  it('does not save incompatible scope injected into the DOM', async () => {
    await render();
    await clickButton('Nuevo usuario');
    await completeDetails();
    await choose('userRole', 'RESPONSABLE_ESTABLECIMIENTO');
    const scope = select('userScope');
    scope.add(new Option('Nacional no autorizado', 'NACIONAL'));
    await choose('userScope', 'NACIONAL');
    await clickButton('Crear perfil pendiente');
    expect(create).not.toHaveBeenCalled();
  });

  it('does not save an inactive or unknown target injected into the DOM', async () => {
    await render();
    await clickButton('Nuevo usuario');
    await completeDetails();
    await choose('userRole', 'RESPONSABLE_ESTABLECIMIENTO');
    for (const id of ['facility-inactive', 'facility-outside-scope']) {
      select('userTarget').add(new Option('Territorio inválido', id));
      await choose('userTarget', id);
      await clickButton('Crear perfil pendiente');
      expect(create).not.toHaveBeenCalled();
    }
  });

  it('shows an empty-state explanation and blocks save when no active targets exist', async () => {
    vi.spyOn(TestBed.inject(TerritorialApiService), 'listCatalog').mockReturnValue(
      of({ municipalities: [], facilities: [] }),
    );
    await render();
    await clickButton('Nuevo usuario');
    await completeDetails();
    await choose('userRole', 'RESPONSABLE_ESTABLECIMIENTO');
    expect(select('userTarget').disabled).toBe(true);
    expect(host.textContent).toContain('No hay territorios activos disponibles');
    await clickButton('Crear perfil pendiente');
    expect(create).not.toHaveBeenCalled();
  });

  it('does not offer national roles or scope to the regional administrator', async () => {
    TestBed.inject(RoleContext).select('regional-superadmin');
    await render();
    await clickButton('Nuevo usuario');
    expect(options('userRole')).not.toContain('ADMIN_CENTRAL');
    expect(options('userRole')).not.toContain('SUPERADMIN_REGIONAL');
    expect(options('userScope')).toEqual(['REGION']);
  });

  it('requires an explicit territory and only submits the matching territorial identifier', async () => {
    await render();
    await clickButton('Nuevo usuario');
    await completeDetails();
    await choose('userRole', 'RESPONSABLE_ESTABLECIMIENTO');
    await clickButton('Crear perfil pendiente');
    expect(create).not.toHaveBeenCalled();
    await choose('userTarget', 'facility-1');
    await clickButton('Crear perfil pendiente');
    expect(create).toHaveBeenCalledOnce();
    const payload = create.mock.calls[0][0];
    expect(payload).toMatchObject({
      roleCode: 'RESPONSABLE_ESTABLECIMIENTO',
      scopeType: 'ESTABLECIMIENTO',
      facilityId: 'facility-1',
    });
    expect(payload).not.toHaveProperty('regionId');
    expect(payload).not.toHaveProperty('municipalityId');
  });

  it('allows editing a national assignment without requiring a fictitious territory ID', async () => {
    users.push({
      id: 'user-2',
      fullName: 'Persona central',
      email: 'central@example.org',
      active: false,
      hasExternalIdentity: false,
      role: { code: 'ADMIN_CENTRAL', name: 'Admin Central', startDate: '2026-09-01' },
      assignment: { scopeType: 'NACIONAL', label: 'Honduras', startDate: '2026-09-01' },
      updatedAt: '2026-09-02T12:00:00Z',
    });
    await render();
    await clickButton('Cambiar acceso');
    expect(host.querySelector('[name="userTarget"]')).toBeNull();
    await completeDetails();
    await clickButton('Guardar cambio versionado');
    expect(changeAccess).toHaveBeenCalledOnce();
    expect(changeAccess.mock.calls[0][1]).toMatchObject({
      roleCode: 'ADMIN_CENTRAL',
      scopeType: 'NACIONAL',
    });
    expect(changeAccess.mock.calls[0][1]).not.toHaveProperty('regionId');
    expect(changeAccess.mock.calls[0][1]).not.toHaveProperty('municipalityId');
    expect(changeAccess.mock.calls[0][1]).not.toHaveProperty('facilityId');
  });

  it('preserves the assigned facility when opening access changes', async () => {
    users.push({
      id: 'user-2',
      fullName: 'Persona local',
      email: 'local@example.org',
      active: false,
      hasExternalIdentity: false,
      role: { code: 'RESPONSABLE_ESTABLECIMIENTO', name: 'Responsable', startDate: '2026-09-01' },
      assignment: {
        scopeType: 'ESTABLECIMIENTO',
        regionId: 'region-1',
        municipalityId: 'municipality-1',
        facilityId: 'facility-1',
        label: 'Centro QA',
        startDate: '2026-09-01',
      },
      updatedAt: '2026-09-02T12:00:00Z',
    });
    await render();
    await clickButton('Cambiar acceso');
    expect(select('userTarget').value).toBe('facility-1');
    await completeDetails();
    await clickButton('Guardar cambio versionado');
    expect(changeAccess.mock.calls[0][1]).toMatchObject({
      scopeType: 'ESTABLECIMIENTO',
      facilityId: 'facility-1',
      expectedUpdatedAt: '2026-09-02T12:00:00Z',
    });
  });
});
