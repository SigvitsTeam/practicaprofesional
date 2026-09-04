import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RoleCode, type AuthorizationSubject } from '../domain/authorization.types';
import { IdentityRepository } from '../application/identity.repository';
import {
  authorizationSubjectQuery,
  type AuthorizationSubjectRow,
} from './authorization-subject.query';

const VALID_ROLE_CODES = new Set<string>(Object.values(RoleCode));

@Injectable()
export class PrismaIdentityRepository extends IdentityRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findSubject(issuer: string, subject: string): Promise<AuthorizationSubject | null> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [identity] = await this.prisma.client.$queryRaw<AuthorizationSubjectRow[]>(
      authorizationSubjectQuery(issuer, subject, today),
    );
    if (!identity) return null;

    return {
      userId: identity.userId,
      displayName: identity.displayName,
      roles: identity.roles.filter((code): code is RoleCode => VALID_ROLE_CODES.has(code)),
      permissions: identity.permissions,
      territory: {
        national: identity.national,
        regionIds: identity.regionIds,
        regionGrantIds: identity.regionGrantIds,
        municipalityIds: identity.municipalityIds,
        facilityIds: identity.facilityIds,
      },
    };
  }
}
