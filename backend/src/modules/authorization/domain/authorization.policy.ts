import { Injectable } from '@nestjs/common';
import {
  DataLevel,
  RoleCode,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type AuthorizationSubject,
  type TargetTerritory,
} from './authorization.types';

@Injectable()
export class AuthorizationPolicy {
  evaluate(subject: AuthorizationSubject, request: AuthorizationRequest): AuthorizationDecision {
    if (!this.hasPermission(subject.permissions, request.permission)) {
      return { allowed: false, reason: 'MISSING_PERMISSION' };
    }

    if (
      request.dataLevel !== DataLevel.Configuration &&
      subject.roles.some(
        (role) => role === RoleCode.SuperAdmin || role === RoleCode.RegionalSuperAdmin,
      )
    ) {
      return { allowed: false, reason: 'ADMINISTRATIVE_ROLE_RESTRICTED' };
    }

    if (!this.isWithinGrantedTerritory(subject, request.target)) {
      return { allowed: false, reason: 'OUTSIDE_TERRITORY' };
    }

    if (
      request.dataLevel === DataLevel.Individual &&
      !this.canAccessIndividualData(subject, request.target)
    ) {
      return { allowed: false, reason: 'INDIVIDUAL_DATA_RESTRICTED' };
    }

    return { allowed: true };
  }

  private hasPermission(permissions: readonly string[], requiredPermission: string): boolean {
    return permissions.includes(requiredPermission) || permissions.includes('*');
  }

  private isWithinGrantedTerritory(
    subject: AuthorizationSubject,
    target: TargetTerritory,
  ): boolean {
    if (target.national) return subject.territory.national;
    if (
      target.facilityId !== undefined &&
      subject.roles.includes(RoleCode.FacilityManager) &&
      !this.isFacilityWithinGrantedTerritory(subject, target.facilityId)
    )
      return false;
    if (subject.territory.national) return true;

    const regionAllowed =
      target.regionId === undefined || subject.territory.regionIds.includes(target.regionId);
    const municipalityAllowed =
      target.municipalityId === undefined ||
      subject.territory.municipalityIds.includes(target.municipalityId);
    const facilityAllowed =
      target.facilityId === undefined ||
      this.isFacilityWithinGrantedTerritory(subject, target.facilityId);

    return regionAllowed && municipalityAllowed && facilityAllowed;
  }

  private canAccessIndividualData(subject: AuthorizationSubject, target: TargetTerritory): boolean {
    if (!target.facilityId) return false;

    if (subject.roles.includes(RoleCode.FacilityManager)) {
      return this.isFacilityWithinGrantedTerritory(subject, target.facilityId);
    }

    if (subject.roles.includes(RoleCode.CoordinationDataEntry)) {
      return subject.territory.facilityIds.includes(target.facilityId);
    }

    return false;
  }

  private isFacilityWithinGrantedTerritory(
    subject: AuthorizationSubject,
    facilityId: string,
  ): boolean {
    if (subject.roles.includes(RoleCode.FacilityManager)) {
      return (subject.territory.facilityGrantIds ?? []).includes(facilityId);
    }

    return subject.territory.facilityIds.includes(facilityId);
  }
}
