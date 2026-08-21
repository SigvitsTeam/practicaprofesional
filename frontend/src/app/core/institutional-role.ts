import { RoleId } from './models';

const ROLE_CODE_MAP: Readonly<Record<string, RoleId>> = {
  SUPERADMIN: 'superadmin',
  ADMIN_CENTRAL: 'central-validator',
  SUPERADMIN_REGIONAL: 'regional-superadmin',
  ADMIN_REGIONAL: 'regional-admin',
  COORDINADOR_MUNICIPAL: 'municipal-coordinator',
  DIGITADOR_COORDINACION: 'coordination-digitizer',
  RESPONSABLE_ESTABLECIMIENTO: 'establishment-manager',
  SUPERVISOR_CONSULTA: 'supervisor',
};

export function mapInstitutionalRoleCodes(codes: readonly string[]): RoleId[] {
  return [
    ...new Set(codes.map((code) => ROLE_CODE_MAP[code]).filter((role): role is RoleId => !!role)),
  ];
}
