import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RoleCode, type AuthorizationSubject } from '../domain/authorization.types';
import { IdentityRepository } from '../application/identity.repository';

const VALID_ROLE_CODES = new Set<string>(Object.values(RoleCode));

@Injectable()
export class PrismaIdentityRepository extends IdentityRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findSubject(issuer: string, subject: string): Promise<AuthorizationSubject | null> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const identity = await this.prisma.client.externalIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
      include: {
        user: {
          include: {
            roles: {
              where: {
                active: true,
                startDate: { lte: today },
                OR: [{ endDate: null }, { endDate: { gte: today } }],
              },
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      where: { permission: { active: true } },
                      include: { permission: true },
                    },
                  },
                },
              },
            },
            assignments: {
              where: {
                active: true,
                startDate: { lte: today },
                OR: [{ endDate: null }, { endDate: { gte: today } }],
              },
              include: {
                region: {
                  include: {
                    municipalities: {
                      where: { active: true },
                      include: { facilities: { where: { active: true } } },
                    },
                  },
                },
                municipality: {
                  include: {
                    region: true,
                    facilities: { where: { active: true } },
                  },
                },
                facility: { include: { municipality: { include: { region: true } } } },
              },
            },
          },
        },
      },
    });

    if (!identity?.user.active) return null;

    const regionIds = new Set<string>();
    const municipalityIds = new Set<string>();
    const facilityIds = new Set<string>();
    let national = false;

    for (const assignment of identity.user.assignments) {
      if (assignment.scopeType === 'NACIONAL') national = true;
      if (assignment.region) {
        regionIds.add(assignment.region.id);
        for (const municipality of assignment.region.municipalities) {
          municipalityIds.add(municipality.id);
          municipality.facilities.forEach((facility) => facilityIds.add(facility.id));
        }
      }
      if (assignment.municipality) {
        regionIds.add(assignment.municipality.regionId);
        municipalityIds.add(assignment.municipality.id);
        assignment.municipality.facilities.forEach((facility) => facilityIds.add(facility.id));
      }
      if (assignment.facility) {
        regionIds.add(assignment.facility.municipality.regionId);
        municipalityIds.add(assignment.facility.municipalityId);
        facilityIds.add(assignment.facility.id);
      }
    }

    const roles = identity.user.roles
      .map(({ role }) => role.code)
      .filter((code): code is RoleCode => VALID_ROLE_CODES.has(code));
    const permissions = new Set(
      identity.user.roles.flatMap(({ role }) =>
        role.rolePermissions.map(({ permission }) => permission.code),
      ),
    );

    return {
      userId: identity.user.id,
      displayName: identity.user.fullName,
      roles,
      permissions: [...permissions],
      territory: {
        national,
        regionIds: [...regionIds],
        municipalityIds: [...municipalityIds],
        facilityIds: [...facilityIds],
      },
    };
  }
}
