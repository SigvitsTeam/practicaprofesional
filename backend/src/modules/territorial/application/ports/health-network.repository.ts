import type { CreateHealthNetworkInput, HealthNetworkSummary } from '../../domain/health-network';
import type { AuditContext } from '../../domain/region';
import type { OperationalStatus } from '../../domain/region';

export abstract class HealthNetworkRepository {
  abstract list(filter: {
    national: boolean;
    regionGrantIds: readonly string[];
    municipalityIds: readonly string[];
    asOf: Date;
  }): Promise<HealthNetworkSummary[]>;
  abstract resolveRegion(regionId: string): Promise<{ id: string; active: boolean } | null>;
  abstract validateMunicipalities(
    regionId: string,
    municipalityIds: readonly string[],
  ): Promise<boolean>;
  abstract findRegionId(networkId: string): Promise<string | null>;
  abstract findStatusContext(networkId: string): Promise<{
    id: string;
    regionId: string;
    operationalStatus: OperationalStatus;
    active: boolean;
    updatedAt: Date;
  } | null>;
  abstract create(input: CreateHealthNetworkInput): Promise<HealthNetworkSummary>;
  abstract replaceMunicipalities(input: {
    networkId: string;
    municipalityIds: string[];
    effectiveDate: Date;
    expectedUpdatedAt: Date;
    audit: AuditContext;
  }): Promise<HealthNetworkSummary>;
  abstract updateStatus(input: {
    networkId: string;
    status: OperationalStatus;
    expectedUpdatedAt: Date;
    audit: AuditContext;
  }): Promise<HealthNetworkSummary>;
}
