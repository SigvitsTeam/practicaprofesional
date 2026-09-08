import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { ConfigService } from '@nestjs/config';
import { TerritorialAnalyticsUseCase } from './territorial-analytics.use-case';
import { TerritorialAnalyticsRepository } from './ports/territorial-analytics.repository';

describe('TerritorialAnalyticsUseCase', () => {
  const list = jest.fn();
  const repository = { list } as unknown as jest.Mocked<TerritorialAnalyticsRepository>;
  const useCase = new TerritorialAnalyticsUseCase(
    repository,
    new ConfigService({ app: { territorialAnalyticsSmallCountThreshold: 5 } }),
  );
  const regionalSubject: AuthorizationSubject = {
    userId: 'regional-1',
    roles: [RoleCode.RegionalAdmin],
    permissions: ['analytics:territorial:read'],
    territory: {
      national: false,
      regionIds: ['region-1'],
      municipalityIds: ['municipality-1'],
      facilityIds: ['facility-1'],
    },
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
        regionalSubject,
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

  it('reemplaza conteos positivos bajos por null y declara la supresión en el contrato', async () => {
    list.mockResolvedValue([
      {
        id: 'municipality-1',
        code: '0506',
        name: 'Puerto Cortés',
        status: 'ENVIADO_A_REGION',
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
    expect(result.rows[0]).toMatchObject({
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

  it('rechaza el nivel nacional para un usuario regional', async () => {
    await expect(
      useCase.execute({ level: 'REGION', year: 2026, month: 8 }, regionalSubject),
    ).rejects.toThrow('alcance nacional');
    expect(list).not.toHaveBeenCalled();
  });
});
