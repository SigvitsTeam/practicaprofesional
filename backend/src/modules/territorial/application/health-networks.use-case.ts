import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  HealthNetworkNotFoundError,
  HealthNetworkStatusTransitionError,
  InvalidHealthNetworkError,
  type HealthNetworkSummary,
} from '../domain/health-network';
import { OperationalStatus, type AuditContext } from '../domain/region';
import { TerritorialScopeDeniedError } from '../domain/territorial-catalog';
import { HealthNetworkRepository } from './ports/health-network.repository';
import { networkMembershipDate } from '../domain/network-membership-date';

@Injectable()
export class HealthNetworksUseCase {
  constructor(private readonly repository: HealthNetworkRepository) {}

  list(subject: AuthorizationSubject, asOf?: string): Promise<HealthNetworkSummary[]> {
    // A contextual parent region is not authorization to read its other networks.
    return this.repository.list({
      national: subject.territory.national,
      regionGrantIds: subject.territory.regionGrantIds ?? [],
      municipalityIds: subject.territory.municipalityIds,
      asOf: networkMembershipDate(
        asOf ??
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Tegucigalpa',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date()),
      ),
    });
  }

  async create(
    input: {
      regionId: string;
      code: string;
      name: string;
      description?: string;
      operationalStatus: OperationalStatus;
      startDate: string;
      municipalityIds: string[];
    },
    subject: AuthorizationSubject,
    audit: AuditContext,
  ): Promise<HealthNetworkSummary> {
    this.requireRegion(input.regionId, subject);
    const region = await this.repository.resolveRegion(input.regionId);
    if (!region?.active) throw new InvalidHealthNetworkError('La región activa no existe.');
    const municipalityIds = [...new Set(input.municipalityIds)];
    if (!(await this.repository.validateMunicipalities(input.regionId, municipalityIds)))
      throw new InvalidHealthNetworkError(
        'Todos los municipios deben estar activos y pertenecer a la región seleccionada.',
      );
    return this.repository.create({
      regionId: input.regionId,
      code: this.code(input.code),
      name: this.text(input.name, 120),
      description: input.description?.trim().replace(/\s+/g, ' ') || null,
      operationalStatus: input.operationalStatus,
      startDate: this.date(input.startDate),
      municipalityIds,
      audit,
    });
  }

  async replaceMunicipalities(
    networkId: string,
    input: { municipalityIds: string[]; effectiveDate: string; expectedUpdatedAt: string },
    subject: AuthorizationSubject,
    audit: AuditContext,
  ): Promise<HealthNetworkSummary> {
    const regionId = await this.repository.findRegionId(networkId);
    if (!regionId) throw new HealthNetworkNotFoundError('La red no existe.');
    this.requireRegion(regionId, subject);
    const municipalityIds = [...new Set(input.municipalityIds)];
    if (!(await this.repository.validateMunicipalities(regionId, municipalityIds)))
      throw new InvalidHealthNetworkError(
        'Todos los municipios deben estar activos y pertenecer a la región de la red.',
      );
    return this.repository.replaceMunicipalities({
      networkId,
      municipalityIds,
      effectiveDate: this.date(input.effectiveDate),
      expectedUpdatedAt: this.timestamp(input.expectedUpdatedAt),
      audit,
    });
  }

  async updateStatus(
    networkId: string,
    input: { status: OperationalStatus; expectedUpdatedAt: string },
    subject: AuthorizationSubject,
    audit: AuditContext,
  ): Promise<HealthNetworkSummary> {
    const network = await this.repository.findStatusContext(networkId);
    if (!network) throw new HealthNetworkNotFoundError('La red no existe.');
    this.requireRegion(network.regionId, subject);
    const allowed: Record<OperationalStatus, OperationalStatus[]> = {
      [OperationalStatus.Preconfigured]: [OperationalStatus.Created, OperationalStatus.InPilot],
      [OperationalStatus.Created]: [OperationalStatus.InPilot, OperationalStatus.Active],
      [OperationalStatus.InPilot]: [
        OperationalStatus.Active,
        OperationalStatus.Suspended,
        OperationalStatus.Inactive,
      ],
      [OperationalStatus.Active]: [OperationalStatus.Suspended, OperationalStatus.Inactive],
      [OperationalStatus.Suspended]: [OperationalStatus.Active, OperationalStatus.Inactive],
      [OperationalStatus.Inactive]: [OperationalStatus.Active],
    };
    if (!allowed[network.operationalStatus].includes(input.status))
      throw new HealthNetworkStatusTransitionError(
        `No se permite cambiar una red de ${network.operationalStatus} a ${input.status}.`,
      );
    return this.repository.updateStatus({
      networkId,
      status: input.status,
      expectedUpdatedAt: this.timestamp(input.expectedUpdatedAt),
      audit,
    });
  }

  private requireRegion(regionId: string, subject: AuthorizationSubject): void {
    if (!subject.territory.national && !subject.territory.regionIds.includes(regionId))
      throw new TerritorialScopeDeniedError();
  }
  private code(value: string): string {
    const code = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code))
      throw new InvalidHealthNetworkError(
        'El código debe contener entre 2 y 30 caracteres válidos.',
      );
    return code;
  }
  private text(value: string, max: number): string {
    const text = value.trim().replace(/\s+/g, ' ');
    if (text.length < 3 || text.length > max)
      throw new InvalidHealthNetworkError(`El nombre debe contener entre 3 y ${max} caracteres.`);
    return text;
  }
  private date(value: string): Date {
    return networkMembershipDate(value);
  }
  private timestamp(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new InvalidHealthNetworkError('La versión de la red no es válida.');
    return date;
  }
}
