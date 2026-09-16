import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import {
  deriveTerritorialCentroids,
  PrismaTerritorialAnalyticsRepository,
} from './prisma-territorial-analytics.repository';

describe('PrismaTerritorialAnalyticsRepository.list', () => {
  const periodUpdatedAt = new Date('2026-08-31T23:59:59.000Z');
  const regionFindMany = jest.fn();
  const municipalityFindMany = jest.fn();
  const healthFacilityFindMany = jest.fn();
  const reportingPeriodFindFirst = jest.fn();
  const reportingPeriodFindUnique = jest.fn();
  const itsReportFindMany = jest.fn();
  const queryRaw = jest.fn();
  const repository = new PrismaTerritorialAnalyticsRepository({
    client: {
      $queryRaw: queryRaw,
      region: { findMany: regionFindMany },
      municipality: { findMany: municipalityFindMany },
      healthFacility: { findMany: healthFacilityFindMany },
      reportingPeriod: {
        findFirst: reportingPeriodFindFirst,
        findUnique: reportingPeriodFindUnique,
      },
      itsReport: { findMany: itsReportFindMany },
    },
  } as unknown as PrismaService);
  const input = {
    level: 'MUNICIPIO' as const,
    year: 2026,
    month: 8,
    regionId: 'region-1',
    scope: {
      national: false,
      regionIds: ['region-1'],
      municipalityIds: ['municipality-1'],
      municipalityScopeIds: ['municipality-1'],
      facilityIds: ['facility-1', 'facility-2'],
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    regionFindMany.mockResolvedValue([]);
    municipalityFindMany.mockResolvedValue([
      {
        id: 'municipality-1',
        regionId: 'region-1',
        officialCode: '0506',
        name: 'Puerto Cortés',
      },
    ]);
    healthFacilityFindMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([]);
    reportingPeriodFindUnique.mockResolvedValue({ status: 'ABIERTO', updatedAt: periodUpdatedAt });
  });

  it('suma atenciones ITS-1 activas y sus diagnósticos sin reutilizar detalles ITS-2', async () => {
    const latestUpdatedAt = new Date('2026-08-11T15:00:00.000Z');
    const sentAt = new Date('2026-08-12T09:00:00.000Z');
    reportingPeriodFindFirst.mockResolvedValue({
      id: 'period-1',
      status: 'ABIERTO',
      updatedAt: periodUpdatedAt,
    });
    itsReportFindMany.mockResolvedValue([
      {
        id: 'report-1',
        regionId: 'region-1',
        municipalityId: 'municipality-1',
        facilityId: null,
        status: 'ENVIADO_A_REGION',
        version: 4,
        sourceAttentionCount: 999,
        sentAt,
        _count: { observations: 2 },
      },
    ]);
    queryRaw.mockResolvedValue([
      {
        entityId: 'municipality-1',
        attentions: 2,
        newCases: 2,
        controls: 1,
        sourceUpdatedAt: latestUpdatedAt,
      },
    ]);

    const rows = await repository.list(input);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'municipality-1',
        status: 'ENVIADO_A_REGION',
        reportId: 'report-1',
        reportVersion: 4,
        dataStatus: 'PRELIMINAR',
        dataSource: 'ITS1',
        attentions: 2,
        newCases: 2,
        controls: 1,
        alerts: 2,
        sourceUpdatedAt: latestUpdatedAt,
        sentAt,
      }),
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const query = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.text).toContain('COUNT(DISTINCT a.id)');
    expect(query.text).toContain('a.municipio_id');
    expect(query.text).toContain('diagnosticos_atencion');
    expect(query.values).toEqual(['period-1', 'municipality-1']);
  });

  it('incluye entidades hoy inactivas con atenciones ITS-1 activas en el período', async () => {
    reportingPeriodFindFirst.mockResolvedValue({
      id: 'period-1',
      status: 'ABIERTO',
      updatedAt: periodUpdatedAt,
    });
    itsReportFindMany.mockResolvedValue([]);
    municipalityFindMany.mockResolvedValue([
      {
        id: 'municipality-active',
        regionId: 'region-1',
        officialCode: '0506',
        name: 'Municipio activo',
      },
      {
        id: 'municipality-historical',
        regionId: 'region-1',
        officialCode: '0507',
        name: 'Municipio histórico',
      },
    ]);
    queryRaw.mockResolvedValue([
      {
        entityId: 'municipality-historical',
        attentions: 3,
        newCases: 2,
        controls: 1,
        sourceUpdatedAt: new Date('2026-08-15T12:00:00.000Z'),
      },
    ]);

    const rows = await repository.list({
      ...input,
      scope: {
        ...input.scope,
        municipalityIds: ['municipality-active'],
        municipalityScopeIds: ['municipality-active'],
        regionGrantIds: ['region-1'],
      },
    });

    expect(municipalityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          regionId: 'region-1',
          AND: [
            {
              OR: [
                { active: true },
                {
                  attentions: {
                    some: { monthlyPeriodId: 'period-1', status: 'ACTIVO' },
                  },
                },
              ],
            },
            {
              OR: [{ id: { in: ['municipality-active'] } }, { regionId: { in: ['region-1'] } }],
            },
          ],
        },
      }),
    );
    expect(healthFacilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { active: true },
            {
              attentions: {
                some: { monthlyPeriodId: 'period-1', status: 'ACTIVO' },
              },
            },
          ],
          municipality: { id: { in: ['municipality-active', 'municipality-historical'] } },
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({ id: 'municipality-active', attentions: 0 }),
      expect.objectContaining({
        id: 'municipality-historical',
        attentions: 3,
        newCases: 2,
        controls: 1,
      }),
    ]);
  });

  it('si el período no existe devuelve únicamente el catálogo activo con valores cero', async () => {
    reportingPeriodFindFirst.mockResolvedValue(null);

    const rows = await repository.list(input);

    expect(municipalityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          regionId: 'region-1',
          AND: [
            { active: true },
            {
              OR: [{ id: { in: ['municipality-1'] } }, { regionId: { in: [] } }],
            },
          ],
        },
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'municipality-1',
        status: 'SIN_REPORTE',
        dataStatus: 'PRELIMINAR',
        attentions: 0,
      }),
    ]);
    expect(itsReportFindMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(reportingPeriodFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['ABIERTO', 'PRELIMINAR'],
    ['CERRADO', 'OFICIAL'],
  ] as const)(
    'marca datos %s como %s y conserva el estado del workflow',
    async (period, status) => {
      reportingPeriodFindFirst.mockResolvedValue({
        id: 'period-1',
        status: period,
        updatedAt: periodUpdatedAt,
      });
      reportingPeriodFindUnique.mockResolvedValue({ status: period, updatedAt: periodUpdatedAt });
      itsReportFindMany.mockResolvedValue([
        {
          id: 'report-1',
          regionId: 'region-1',
          municipalityId: 'municipality-1',
          facilityId: null,
          status: 'APROBADO_REGION',
          version: 2,
          sentAt: null,
          _count: { observations: 0 },
        },
      ]);
      queryRaw.mockResolvedValue([]);

      const [row] = await repository.list(input);

      expect(row).toMatchObject({
        status: 'APROBADO_REGION',
        dataStatus: status,
        dataSource: 'ITS1',
      });
    },
  );

  it.each([
    ['CERRADO', 'ABIERTO'],
    ['ABIERTO', 'CERRADO'],
  ] as const)(
    'mantiene los datos preliminares si el período cambia de %s a %s durante la consulta',
    async (initialStatus, confirmedStatus) => {
      reportingPeriodFindFirst.mockResolvedValue({
        id: 'period-1',
        status: initialStatus,
        updatedAt: periodUpdatedAt,
      });
      reportingPeriodFindUnique.mockResolvedValue({
        status: confirmedStatus,
        updatedAt: periodUpdatedAt,
      });
      itsReportFindMany.mockResolvedValue([]);

      const row = (await repository.list(input))[0]!;

      expect(row.dataStatus).toBe('PRELIMINAR');
      expect(queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(
        reportingPeriodFindUnique.mock.invocationCallOrder[0]!,
      );
    },
  );

  it('mantiene el dato preliminar si el período fue reabierto y cerrado durante la consulta', async () => {
    reportingPeriodFindFirst.mockResolvedValue({
      id: 'period-1',
      status: 'CERRADO',
      updatedAt: periodUpdatedAt,
    });
    reportingPeriodFindUnique.mockResolvedValue({
      status: 'CERRADO',
      updatedAt: new Date('2026-09-01T00:05:00.000Z'),
    });
    itsReportFindMany.mockResolvedValue([]);

    const row = (await repository.list(input))[0]!;

    expect(row.dataStatus).toBe('PRELIMINAR');
  });

  it('incluye un establecimiento histórico sólo por una concesión municipal directa', async () => {
    reportingPeriodFindFirst.mockResolvedValue({
      id: 'period-1',
      status: 'ABIERTO',
      updatedAt: periodUpdatedAt,
    });
    itsReportFindMany.mockResolvedValue([]);
    healthFacilityFindMany.mockResolvedValue([
      {
        id: 'facility-historical',
        municipalityId: 'municipality-1',
        code: 'E02',
        name: 'Establecimiento histórico',
        latitude: null,
        longitude: null,
        coordinatesValidated: false,
      },
    ]);

    await repository.list({
      level: 'ESTABLECIMIENTO',
      year: 2026,
      month: 8,
      municipalityId: 'municipality-1',
      scope: {
        national: false,
        regionIds: ['region-1'],
        municipalityIds: ['municipality-1'],
        municipalityGrantIds: ['municipality-1'],
        facilityIds: ['facility-active'],
      },
    });

    expect(healthFacilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          municipalityId: 'municipality-1',
          AND: [
            {
              OR: [
                { active: true },
                {
                  attentions: {
                    some: { monthlyPeriodId: 'period-1', status: 'ACTIVO' },
                  },
                },
              ],
            },
            {
              OR: [
                { id: { in: ['facility-active'] } },
                { municipalityId: { in: ['municipality-1'] } },
                { municipality: { regionId: { in: [] } } },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('no amplía una concesión directa de establecimiento a sus establecimientos hermanos', async () => {
    reportingPeriodFindFirst.mockResolvedValue({
      id: 'period-1',
      status: 'ABIERTO',
      updatedAt: periodUpdatedAt,
    });
    itsReportFindMany.mockResolvedValue([]);
    healthFacilityFindMany.mockResolvedValue([
      {
        id: 'facility-direct',
        municipalityId: 'municipality-1',
        code: 'E01',
        name: 'Establecimiento autorizado',
        latitude: null,
        longitude: null,
        coordinatesValidated: false,
      },
    ]);

    await repository.list({
      level: 'ESTABLECIMIENTO',
      year: 2026,
      month: 8,
      municipalityId: 'municipality-1',
      scope: {
        national: false,
        regionIds: ['region-1'],
        municipalityIds: ['municipality-1'],
        facilityIds: ['facility-direct'],
      },
    });

    expect(healthFacilityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [
                { id: { in: ['facility-direct'] } },
                { municipalityId: { in: [] } },
                { municipality: { regionId: { in: [] } } },
              ],
            },
          ]),
        }),
      }),
    );
  });

  it('no eleva el municipio padre contextual de un establecimiento a alcance agregado', async () => {
    reportingPeriodFindFirst.mockResolvedValue(null);

    await repository.list({
      ...input,
      scope: {
        national: false,
        regionIds: ['region-1'],
        municipalityIds: ['municipality-1'],
        municipalityScopeIds: [],
        facilityIds: ['facility-direct'],
      },
    });

    expect(municipalityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              OR: [{ id: { in: [] } }, { regionId: { in: [] } }],
            },
          ]),
        }),
      }),
    );
  });

  it.each([
    ['REGION', 'a.region_id'],
    ['MUNICIPIO', 'a.municipio_id'],
    ['ESTABLECIMIENTO', 'a.establecimiento_atencion_id'],
  ] as const)('usa una columna territorial SQL fija para el nivel %s', async (level, column) => {
    reportingPeriodFindFirst.mockResolvedValue({
      id: 'period-1',
      status: 'ABIERTO',
      updatedAt: periodUpdatedAt,
    });
    itsReportFindMany.mockResolvedValue([]);
    municipalityFindMany.mockResolvedValue(
      level === 'MUNICIPIO'
        ? [
            {
              id: 'entity-1',
              regionId: 'region-1',
              officialCode: '0506',
              name: 'Municipio Uno',
            },
          ]
        : [],
    );
    regionFindMany.mockResolvedValue(
      level === 'REGION' ? [{ id: 'entity-1', code: 'R01', name: 'Región Uno' }] : [],
    );
    healthFacilityFindMany.mockResolvedValue(
      level === 'ESTABLECIMIENTO'
        ? [
            {
              id: 'entity-1',
              municipalityId: 'municipality-1',
              code: 'E01',
              name: 'Establecimiento Uno',
              latitude: null,
              longitude: null,
              coordinatesValidated: false,
            },
          ]
        : [],
    );

    await repository.list({
      level,
      year: 2026,
      month: 8,
      scope: { national: true, regionIds: [], municipalityIds: [], facilityIds: [] },
    });

    const query = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.text.match(new RegExp(column.replace('.', '\\.'), 'g'))).toHaveLength(3);
  });
});

describe('deriveTerritorialCentroids', () => {
  const entities = [
    { id: 'region-a', code: '01', name: 'Región A' },
    { id: 'region-b', code: '02', name: 'Región B' },
  ];

  it('derives a regional centroid from real facility coordinates', () => {
    const result = deriveTerritorialCentroids('REGION', entities, [
      {
        latitude: '15.800000',
        longitude: '-87.900000',
        coordinatesValidated: true,
        municipality: { id: 'municipality-a', regionId: 'region-a' },
      },
      {
        latitude: '16.000000',
        longitude: '-88.100000',
        coordinatesValidated: false,
        municipality: { id: 'municipality-b', regionId: 'region-a' },
      },
    ]);

    expect(result[0]).toMatchObject({
      latitude: 15.9,
      longitude: -88,
      coordinatesValidated: false,
    });
    expect(result[1]).not.toHaveProperty('latitude');
  });

  it('groups municipal points independently and ignores invalid coordinates', () => {
    const municipalities = [
      { id: 'municipality-a', code: '0101', name: 'Municipio A' },
      { id: 'municipality-b', code: '0102', name: 'Municipio B' },
    ];
    const result = deriveTerritorialCentroids('MUNICIPIO', municipalities, [
      {
        latitude: 15.75,
        longitude: -87.95,
        coordinatesValidated: true,
        municipality: { id: 'municipality-a', regionId: 'region-a' },
      },
      {
        latitude: 120,
        longitude: -87.8,
        coordinatesValidated: true,
        municipality: { id: 'municipality-b', regionId: 'region-a' },
      },
    ]);

    expect(result[0]).toMatchObject({
      latitude: 15.75,
      longitude: -87.95,
      coordinatesValidated: true,
    });
    expect(result[1]).not.toHaveProperty('latitude');
  });
});
