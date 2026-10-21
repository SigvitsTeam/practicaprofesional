import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaTerritorialAuditRepository } from './prisma-territorial-audit.repository';

describe('Scoped territorial history queries', () => {
  it('restricts the national view to descendants of the authorized regions', async () => {
    const region = { findMany: jest.fn().mockResolvedValue([{ id: 'region-1' }]) };
    const municipality = { findMany: jest.fn().mockResolvedValue([{ id: 'municipality-1' }]) };
    const healthFacility = { findMany: jest.fn().mockResolvedValue([{ id: 'facility-1' }]) };
    const auditEvent = { findMany: jest.fn().mockResolvedValue([]) };
    const repository = new PrismaTerritorialAuditRepository({
      client: { region, municipality, healthFacility, auditEvent },
    } as unknown as PrismaService);
    await repository.listTerritoryEvents({
      entityType: 'NACIONAL',
      regionIds: ['region-1'],
      limit: 25,
    });
    expect(region.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['region-1'] } },
      select: { id: true },
    });
    expect(municipality.findMany).toHaveBeenCalledWith({
      where: { regionId: { in: ['region-1'] } },
      select: { id: true },
    });
    expect(healthFacility.findMany).toHaveBeenCalledWith({
      where: { municipalityId: { in: ['municipality-1'] } },
      select: { id: true },
    });
    expect(auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataLevel: 'CONFIGURACION',
          OR: [
            { entity: 'REGION', entityId: { in: ['region-1'] } },
            { entity: { in: ['MUNICIPALITY', 'MUNICIPIO'] }, entityId: { in: ['municipality-1'] } },
            {
              entity: { in: ['HEALTH_FACILITY', 'ESTABLECIMIENTO'] },
              entityId: { in: ['facility-1'] },
            },
          ],
        },
      }),
    );
  });

  it('reads only the selected facility events and retains pagination', async () => {
    const auditEvent = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'event-1',
          action: 'FACILITY_CREATED',
          entity: 'HEALTH_FACILITY',
          reason: 'Alta',
          createdAt: new Date(),
          actor: null,
        },
        {
          id: 'event-2',
          action: 'TERRITORIAL_STATUS_CHANGED',
          entity: 'ESTABLECIMIENTO',
          reason: 'Estado',
          createdAt: new Date(),
          actor: null,
        },
      ]),
    };
    const repository = new PrismaTerritorialAuditRepository({
      client: { auditEvent },
    } as unknown as PrismaService);
    const page = await repository.listTerritoryEvents({
      entityType: 'ESTABLECIMIENTO',
      entityId: 'facility-1',
      limit: 1,
      cursor: 'old-event',
    });
    expect(auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataLevel: 'CONFIGURACION',
          entityId: 'facility-1',
          entity: { in: ['HEALTH_FACILITY', 'ESTABLECIMIENTO'] },
        },
        take: 2,
        cursor: { id: 'old-event' },
        skip: 1,
      }),
    );
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe('event-1');
  });
});
