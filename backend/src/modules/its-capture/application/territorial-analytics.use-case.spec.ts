import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { ConfigService } from '@nestjs/config';
import { TerritorialAnalyticsUseCase } from './territorial-analytics.use-case';
import { TerritorialAnalyticsRepository } from './ports/territorial-analytics.repository';
import { TerritorialAnalyticsPrivacyPolicy } from './territorial-analytics-privacy.policy';

describe('TerritorialAnalyticsUseCase', () => {
  const list = jest.fn();
  const repository = { list } as unknown as jest.Mocked<TerritorialAnalyticsRepository>;
  const useCase = new TerritorialAnalyticsUseCase(
    repository,
    new TerritorialAnalyticsPrivacyPolicy(
      new ConfigService({ app: { territorialAnalyticsSmallCountThreshold: 5 } }),
    ),
  );
  const regionalSubject: AuthorizationSubject = {
    userId: 'regional-1',
    roles: [RoleCode.RegionalAdmin],
    permissions: ['analytics:territorial:read'],
    territory: {
      national: false,
      regionIds: ['region-1'],
      regionGrantIds: ['region-1'],
      municipalityIds: ['municipality-1'],
      municipalityScopeIds: ['municipality-1'],
      facilityIds: ['facility-1'],
    },
  };
  const preliminarySource = {
    dataStatus: 'PRELIMINAR' as const,
    dataSource: 'ITS1' as const,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    list.mockResolvedValue([]);
  });

  it('aplica el alcance autorizado a la consulta municipal', async () => {
    await useCase.execute(
      { level: 'MUNICIPIO', year: 2026, month: 8, regionId: 'region-1' },
      regionalSubject,
    );
    expect(list).toHaveBeenCalledWith({
      level: 'MUNICIPIO',
      year: 2026,
      month: 8,
      regionId: 'region-1',
      scope: regionalSubject.territory,
    });
  });

  it('rechaza un padre explícito fuera del alcance territorial', async () => {
    const municipalSubject: AuthorizationSubject = {
      ...regionalSubject,
      territory: {
        ...regionalSubject.territory,
        regionGrantIds: [],
      },
    };

    await expect(
      useCase.execute(
        { level: 'MUNICIPIO', year: 2026, month: 8, regionId: 'region-2' },
        regionalSubject,
      ),
    ).rejects.toThrow('fuera del alcance autorizado');
    await expect(
      useCase.execute(
        {
          level: 'ESTABLECIMIENTO',
          year: 2026,
          month: 8,
          municipalityId: 'municipality-2',
        },
        municipalSubject,
      ),
    ).rejects.toThrow('fuera del alcance autorizado');
    expect(list).not.toHaveBeenCalled();
  });

  it('rechaza parámetros padre incompatibles con el nivel solicitado', async () => {
    await expect(
      useCase.execute(
        {
          level: 'MUNICIPIO',
          year: 2026,
          month: 8,
          municipalityId: 'municipality-1',
        },
        regionalSubject,
      ),
    ).rejects.toThrow('sólo admite regionId');
    expect(list).not.toHaveBeenCalled();
  });

  it('delega al repositorio el municipio histórico cuando existe una concesión regional directa', async () => {
    const subject: AuthorizationSubject = {
      ...regionalSubject,
      territory: {
        ...regionalSubject.territory,
        regionGrantIds: ['region-1'],
        municipalityIds: [],
        facilityIds: [],
      },
    };

    await useCase.execute(
      {
        level: 'ESTABLECIMIENTO',
        year: 2026,
        month: 8,
        municipalityId: 'municipality-historical',
      },
      subject,
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        municipalityId: 'municipality-historical',
        scope: subject.territory,
      }),
    );
  });

  it('reemplaza conteos positivos bajos por null y declara la supresión en el contrato', async () => {
    list.mockResolvedValue([
      {
        id: 'municipality-1',
        code: '0506',
        name: 'Puerto Cortés',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 4,
        newCases: 8,
        controls: 0,
        alerts: 2,
      },
    ]);

    const result = await useCase.execute(
      { level: 'MUNICIPIO', year: 2026, month: 8 },
      regionalSubject,
    );

    expect(result.privacy).toEqual({ smallCountThreshold: 5, suppressedValue: null });
    expect(result).toMatchObject({
      dataStatus: 'PRELIMINAR',
      dataSource: 'ITS1',
      notice:
        'Datos preliminares acumulados automáticamente desde ITS 1; están pendientes de depuración y aprobación institucional.',
    });
    expect(result.rows[0]).toMatchObject({
      dataStatus: 'PRELIMINAR',
      dataSource: 'ITS1',
      attentions: null,
      newCases: 8,
      controls: 0,
      alerts: null,
      suppressedMetrics: ['attentions', 'alerts'],
      complementarySuppressedMetrics: [],
    });
    expect(JSON.stringify(result)).not.toContain('"attentions":4');
    expect(JSON.stringify(result)).not.toContain('"alerts":2');
  });

  it('aplica supresión complementaria a la menor fila positiva visible por métrica', async () => {
    list.mockResolvedValue([
      {
        id: 'municipality-small',
        parentId: 'region-1',
        code: '0501',
        name: 'Fila pequeña',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 2,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
      {
        id: 'municipality-complementary',
        parentId: 'region-1',
        code: '0502',
        name: 'Fila complementaria',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 8,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
      {
        id: 'municipality-visible',
        parentId: 'region-1',
        code: '0503',
        name: 'Fila visible',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 12,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
    ]);

    const result = await useCase.execute(
      { level: 'MUNICIPIO', year: 2026, month: 8 },
      regionalSubject,
    );

    expect(result.rows).toEqual([
      expect.objectContaining({
        attentions: null,
        suppressedMetrics: ['attentions'],
        complementarySuppressedMetrics: [],
      }),
      expect.objectContaining({
        attentions: null,
        suppressedMetrics: [],
        complementarySuppressedMetrics: ['attentions'],
      }),
      expect.objectContaining({
        attentions: 12,
        suppressedMetrics: [],
        complementarySuppressedMetrics: [],
      }),
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('"attentions":2');
    expect(serialized).not.toContain('"attentions":8');
    expect(serialized).toContain('"attentions":12');
    expect(result.rows.every((row) => !('parentId' in row))).toBe(true);
  });

  it('elige la supresión complementaria dentro de cada padre de forma estable', async () => {
    list.mockResolvedValue([
      {
        id: 'a-small',
        parentId: 'region-a',
        code: 'A1',
        name: 'A pequeña',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 2,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
      {
        id: 'a-complement',
        parentId: 'region-a',
        code: 'A2',
        name: 'A complemento',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 8,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
      {
        id: 'b-small',
        parentId: 'region-b',
        code: 'B1',
        name: 'B pequeña',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 3,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
      {
        id: 'b-complement',
        parentId: 'region-b',
        code: 'B2',
        name: 'B complemento',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 10,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
    ]);

    const result = await useCase.execute(
      { level: 'MUNICIPIO', year: 2026, month: 8 },
      regionalSubject,
    );

    expect(result.rows.map((row) => [row.id, row.attentions])).toEqual([
      ['a-small', null],
      ['a-complement', null],
      ['b-small', null],
      ['b-complement', null],
    ]);
    expect(result.rows[1]?.complementarySuppressedMetrics).toEqual(['attentions']);
    expect(result.rows[3]?.complementarySuppressedMetrics).toEqual(['attentions']);
  });

  it('no añade supresión complementaria cuando no existe otra fila positiva visible', async () => {
    list.mockResolvedValue([
      {
        id: 'municipality-only',
        code: '0501',
        name: 'Única fila',
        status: 'ENVIADO_A_REGION',
        ...preliminarySource,
        attentions: 2,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
      {
        id: 'municipality-zero',
        code: '0502',
        name: 'Fila cero',
        status: 'SIN_REPORTE',
        ...preliminarySource,
        attentions: 0,
        newCases: 0,
        controls: 0,
        alerts: 0,
      },
    ]);

    const result = await useCase.execute(
      { level: 'MUNICIPIO', year: 2026, month: 8 },
      regionalSubject,
    );

    expect(result.rows[0]).toMatchObject({
      attentions: null,
      suppressedMetrics: ['attentions'],
      complementarySuppressedMetrics: [],
    });
    expect(result.rows[1]).toMatchObject({
      attentions: 0,
      suppressedMetrics: [],
      complementarySuppressedMetrics: [],
    });
  });

  it('declara el resultado oficial sólo cuando todas las filas proceden de un período cerrado', async () => {
    list.mockResolvedValue([
      {
        id: 'municipality-1',
        code: '0506',
        name: 'Puerto Cortés',
        status: 'APROBADO_REGION',
        dataStatus: 'OFICIAL',
        dataSource: 'ITS1',
        attentions: 10,
        newCases: 5,
        controls: 5,
        alerts: 0,
      },
    ]);

    const result = await useCase.execute(
      { level: 'MUNICIPIO', year: 2026, month: 8 },
      regionalSubject,
    );

    expect(result).toMatchObject({
      dataStatus: 'OFICIAL',
      dataSource: 'ITS1',
      notice: 'Datos oficiales del período cerrado.',
    });
    expect(result.rows[0]).toMatchObject({
      status: 'APROBADO_REGION',
      dataStatus: 'OFICIAL',
      dataSource: 'ITS1',
    });
  });

  it('rechaza el nivel nacional para un usuario regional', async () => {
    await expect(
      useCase.execute({ level: 'REGION', year: 2026, month: 8 }, regionalSubject),
    ).rejects.toThrow('alcance nacional');
    expect(list).not.toHaveBeenCalled();
  });

  it('no eleva el municipio padre contextual de una asignación de establecimiento', async () => {
    const facilityOnly: AuthorizationSubject = {
      ...regionalSubject,
      roles: [RoleCode.FacilityManager],
      territory: {
        national: false,
        regionIds: ['region-1'],
        regionGrantIds: [],
        municipalityIds: ['municipality-1'],
        municipalityScopeIds: [],
        municipalityGrantIds: [],
        facilityIds: ['facility-1'],
        facilityGrantIds: ['facility-1'],
      },
    };

    await expect(
      useCase.execute({ level: 'MUNICIPIO', year: 2026, month: 8 }, facilityOnly),
    ).rejects.toThrow('asignación municipal o regional directa');
    expect(list).not.toHaveBeenCalled();
  });

  it.each([RoleCode.SuperAdmin, RoleCode.RegionalSuperAdmin])(
    'mantiene a %s fuera de la analítica aun con permisos residuales',
    async (role) => {
      await expect(
        useCase.execute(
          { level: 'MUNICIPIO', year: 2026, month: 8 },
          {
            ...regionalSubject,
            roles: [role],
            permissions: ['*'],
          },
        ),
      ).rejects.toThrow('alcance administrativo');
      expect(list).not.toHaveBeenCalled();
    },
  );
});
