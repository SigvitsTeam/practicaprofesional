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
    if (subject.territory.national) return true;

    const regionAllowed =
      target.regionId === undefined || subject.territory.regionIds.includes(target.regionId);
    const municipalityAllowed =
      target.municipalityId === undefined ||
      subject.territory.municipalityIds.includes(target.municipalityId);
    const facilityAllowed =
      target.facilityId === undefined || subject.territory.facilityIds.includes(target.facilityId);

    return regionAllowed && municipalityAllowed && facilityAllowed;
  }

  private canAccessIndividualData(subject: AuthorizationSubject, target: TargetTerritory): boolean {
    if (!target.facilityId) return false;

    if (subject.roles.includes(RoleCode.FacilityManager)) {
      return subject.territory.facilityIds.includes(target.facilityId);
    }

    if (subject.roles.includes(RoleCode.CoordinationDataEntry)) {
      return (
        target.municipalityId !== undefined &&
        subject.territory.municipalityIds.includes(target.municipalityId) &&
        subject.territory.facilityIds.includes(target.facilityId)
      );
    }

    return false;
  }
}
