import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  TerritorialAuditScopeDeniedError,
  type TerritorialAuditPage,
} from '../domain/territorial-audit';
import { TerritorialAuditRepository } from './ports/territorial-audit.repository';
import { TerritorialAuditUseCase } from './territorial-audit.use-case';

class Repository extends TerritorialAuditRepository {
  findMunicipalityRegion(id: string): Promise<string | null> {
    return Promise.resolve(id === 'missing' ? null : 'region-1');
  }
  findNetworkRegion(id: string): Promise<string | null> {
    return Promise.resolve(id === 'missing' ? null : 'region-1');
  }
  listMunicipalityEvents(): Promise<TerritorialAuditPage> {
    return Promise.resolve({
      items: [
        {
          id: 'event-1',
          action: 'MUNICIPALITY_CREATED',
          entity: 'MUNICIPALITY',
          reason: 'Alta oficial',
          actorName: 'Admin',
          createdAt: new Date('2026-08-19T12:00:00Z'),
        },
      ],
      nextCursor: null,
    });
  }
  listNetworkEvents(): Promise<TerritorialAuditPage> {
    return Promise.resolve({
      items: [
        {
          id: 'event-2',
          action: 'HEALTH_NETWORK_STATUS_CHANGED',
          entity: 'HEALTH_NETWORK',
          reason: 'Activación autorizada',
          actorName: 'Admin regional',
          createdAt: new Date('2026-08-20T12:00:00Z'),
        },
      ],
      nextCursor: null,
    });
  }
}

const subject: AuthorizationSubject = {
  userId: 'user-1',
  roles: [],
  permissions: ['audit:territorial:read'],
  territory: { national: false, regionIds: ['region-1'], municipalityIds: [], facilityIds: [] },
};

describe('TerritorialAuditUseCase', () => {
  it('returns only the bounded page after validating regional scope', async () => {
    const result = await new TerritorialAuditUseCase(new Repository()).listMunicipalityEvents(
      'municipality-1',
      25,
      undefined,
      subject,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.actorName).toBe('Admin');
  });

  it('rejects a municipality outside the assigned region', async () => {
    await expect(
      new TerritorialAuditUseCase(new Repository()).listMunicipalityEvents(
        'municipality-1',
        25,
        undefined,
        { ...subject, territory: { ...subject.territory, regionIds: ['region-2'] } },
      ),
    ).rejects.toBeInstanceOf(TerritorialAuditScopeDeniedError);
  });

  it('returns network events after validating the network region', async () => {
    const result = await new TerritorialAuditUseCase(new Repository()).listNetworkEvents(
      'network-1',
      25,
      undefined,
      subject,
    );
    expect(result.items[0]?.action).toBe('HEALTH_NETWORK_STATUS_CHANGED');
  });

  it('rejects a network outside the assigned region', async () => {
    await expect(
      new TerritorialAuditUseCase(new Repository()).listNetworkEvents('network-1', 25, undefined, {
        ...subject,
        territory: { ...subject.territory, regionIds: ['region-2'] },
      }),
    ).rejects.toBeInstanceOf(TerritorialAuditScopeDeniedError);
  });
});
