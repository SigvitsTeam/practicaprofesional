import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TerritorialConcurrencyError } from '../domain/territorial-catalog';
import { PrismaTerritorialCatalogRepository } from './prisma-territorial-catalog.repository';

describe('Facility coordinate validation persistence', () => {
  const input = {
    id: 'facility-1',
    latitude: 15.82,
    longitude: -87.92,
    source: 'Acta GPS institucional 2026-10-21',
    expectedUpdatedAt: new Date('2026-10-01'),
    audit: {
      actorUserId: 'reviewer-1',
      requestId: 'request-1',
      reason: 'Verificación de ubicación exacta',
    },
  };
  function setup(count: number): {
    healthFacility: { findUnique: jest.Mock; updateMany: jest.Mock };
    auditEvent: { create: jest.Mock };
    repository: PrismaTerritorialCatalogRepository;
  } {
    const healthFacility = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ latitude: 15.8, longitude: -87.9, coordinatesValidated: false }),
      updateMany: jest.fn().mockResolvedValue({ count }),
    };
    const auditEvent = { create: jest.fn().mockResolvedValue({}) };
    const prisma = {
      client: {
        $transaction: jest.fn(
          (
            operation: (tx: {
              healthFacility: typeof healthFacility;
              auditEvent: typeof auditEvent;
            }) => Promise<void>,
          ) => operation({ healthFacility, auditEvent }),
        ),
      },
    };
    return {
      healthFacility,
      auditEvent,
      repository: new PrismaTerritorialCatalogRepository(prisma as unknown as PrismaService),
    };
  }
  it('saves reviewed coordinates and auditable evidence in the same transaction', async () => {
    const { repository, healthFacility, auditEvent } = setup(1);
    await repository.validateCoordinates(input);
    expect(healthFacility.updateMany).toHaveBeenCalledWith({
      where: { id: input.id, updatedAt: input.expectedUpdatedAt },
      data: {
        latitude: 15.82,
        longitude: -87.92,
        coordinatesValidated: true,
        updatedAt: expect.any(Date),
      },
    });
    expect(auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'reviewer-1',
        action: 'FACILITY_COORDINATES_VALIDATED',
        previousData: { latitude: 15.8, longitude: -87.9, coordinatesValidated: false },
        newData: {
          latitude: 15.82,
          longitude: -87.92,
          coordinatesValidated: true,
          source: input.source,
          validatedBy: 'reviewer-1',
          validatedAt: expect.any(String),
        },
      }),
    });
  });
  it('does not record a successful validation when the facility version is stale', async () => {
    const { repository, auditEvent } = setup(0);
    await expect(repository.validateCoordinates(input)).rejects.toBeInstanceOf(
      TerritorialConcurrencyError,
    );
    expect(auditEvent.create).not.toHaveBeenCalled();
  });
});
