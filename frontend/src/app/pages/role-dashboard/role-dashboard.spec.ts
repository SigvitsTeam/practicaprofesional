import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import { OperationalPeriodService } from '../../core/operational-period';
import { ROLE_PROFILES } from '../../core/role-data';
import { TerritorialApiService } from '../../core/territorial-api.service';
import { UserAdminApiService } from '../../core/user-admin-api.service';
import { RoleDashboard } from './role-dashboard';

describe('RoleDashboard', () => {
  const getTerritorialAnalytics = vi.fn();
  const listRegions = vi.fn();
  const listCatalog = vi.fn();
  const listUsers = vi.fn();

  beforeEach(async () => {
    getTerritorialAnalytics.mockReset();
    listRegions.mockReset();
    listCatalog.mockReset();
    listUsers.mockReset();
    getTerritorialAnalytics.mockReturnValue(
      of({
        level: 'ESTABLECIMIENTO',
        year: 2026,
        month: 8,
        dataStatus: 'PRELIMINAR',
        dataSource: 'ITS1',
        notice:
          'Datos preliminares acumulados automáticamente desde ITS 1; están pendientes de depuración y aprobación institucional.',
        rows: [
          {
            id: 'facility-1',
            code: '001',
            name: 'Centro activo',
            status: 'BORRADOR',
            dataStatus: 'PRELIMINAR',
            dataSource: 'ITS1',
            attentions: 40,
            newCases: 30,
            controls: 10,
            alerts: 2,
          },
          {
            id: 'facility-2',
            code: '002',
            name: 'Centro pendiente',
            status: 'SIN_REPORTE',
            dataStatus: 'PRELIMINAR',
            dataSource: 'ITS1',
            attentions: 0,
            newCases: 0,
            controls: 0,
            alerts: 0,
          },
        ],
      }),
    );
    listRegions.mockReturnValue(
      of([
        {
          id: 'region-1',
          code: '05',
          name: 'Cortés',
          type: 'SANITARIA',
          operationalStatus: 'ACTIVO',
          active: true,
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ]),
    );
    listCatalog.mockReturnValue(
      of({
        municipalities: [
          {
            id: 'municipality-1',
            regionId: 'region-1',
            regionName: 'Cortés',
            officialCode: '0506',
            name: 'Puerto Cortés',
            operationalStatus: 'ACTIVO',
            mapValidated: false,
            active: true,
            facilityCount: 1,
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
        facilities: [
          {
            id: 'facility-1',
            municipalityId: 'municipality-1',
            municipalityName: 'Puerto Cortés',
            code: '001',
            name: 'Centro activo',
            type: 'CIS',
            operationalStatus: 'ACTIVO',
            coordinatesValidated: false,
            active: true,
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
    );
    listUsers.mockReturnValue(
      of([
        {
          id: 'user-1',
          fullName: 'Usuario pendiente',
          email: 'usuario@example.test',
          active: true,
          hasExternalIdentity: false,
          role: {
            code: 'COORDINADOR_MUNICIPAL',
            name: 'Coordinador',
            startDate: '2026-01-01',
          },
          assignment: {
            scopeType: 'MUNICIPIO',
            label: 'Puerto Cortés',
            startDate: '2026-01-01',
          },
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [RoleDashboard],
      providers: [
        { provide: AuthService, useValue: { isDemo: signal(false) } },
        { provide: ItsCaptureApiService, useValue: { getTerritorialAnalytics } },
        { provide: TerritorialApiService, useValue: { listRegions, listCatalog } },
        { provide: UserAdminApiService, useValue: { list: listUsers } },
      ],
    }).compileComponents();
    TestBed.inject(OperationalPeriodService).useDemoCatalog();
  });

  it('muestra al superadmin únicamente indicadores y pendientes administrativos', async () => {
    const fixture = TestBed.createComponent(RoleDashboard);
    fixture.componentRef.setInput(
      'role',
      ROLE_PROFILES.find((role) => role.id === 'superadmin')!,
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(getTerritorialAnalytics).not.toHaveBeenCalled();
    expect(listRegions).toHaveBeenCalled();
    expect(listUsers).toHaveBeenCalled();
    expect(text).toContain('Regiones activas');
    expect(text).toContain('Usuarios habilitados');
    expect(text).toContain('Configuración pendiente');
    expect(text).toContain('usuario sin identidad vinculada');
    expect(text).not.toContain('Atenciones registradas');
    expect(text).not.toContain('Casos nuevos');
  });

  it('mantiene etiquetas exclusivamente administrativas durante la carga y tras un error', async () => {
    const pendingRegions = new Subject<never[]>();
    listRegions.mockReturnValue(pendingRegions);
    const fixture = TestBed.createComponent(RoleDashboard);
    fixture.componentRef.setInput(
      'role',
      ROLE_PROFILES.find((role) => role.id === 'superadmin')!,
    );
    fixture.detectChanges();

    let text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Cargando estado administrativo');
    expect(text).toContain('Regiones activas');
    expect(text).toContain('Configuración pendiente');
    expect(text).not.toContain('Atenciones registradas');
    expect(text).not.toContain('Datos preliminares');
    expect(text).not.toContain('Pendientes del período');

    pendingRegions.error(new Error('offline'));
    await fixture.whenStable();
    fixture.detectChanges();
    text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('No fue posible cargar el estado administrativo');
    expect(text).toContain('Regiones activas');
    expect(text).not.toContain('Atenciones registradas');
    expect(text).not.toContain('Sin alertas operativas');
    expect(text).not.toContain('Pendientes del período');
  });

  it('calcula el panel operativo desde ITS 1 y comunica que los datos son preliminares', async () => {
    const fixture = TestBed.createComponent(RoleDashboard);
    fixture.componentRef.setInput(
      'role',
      ROLE_PROFILES.find((role) => role.id === 'municipal-coordinator')!,
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const navigation = vi.fn();
    fixture.componentInstance.navigate.subscribe(navigation);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(getTerritorialAnalytics).toHaveBeenCalledWith(
      'ESTABLECIMIENTO',
      expect.any(Number),
      expect.any(Number),
    );
    expect(text).toContain('Datos preliminares');
    expect(text).toContain('Suma automática desde ITS 1');
    expect(text).toContain('40');
    expect(text).toContain('1 territorio sin reporte vigente');
    expect(text).toContain('Centro pendiente');
    expect(text).not.toContain('Permisos efectivos');
    expect(text).not.toContain('Flujo principal');

    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.role-priorities button',
      ),
    )
      .find((button) => button.textContent?.includes('sin reporte vigente'))
      ?.click();
    expect(navigation).toHaveBeenCalledWith('Consolidados');
  });
});
