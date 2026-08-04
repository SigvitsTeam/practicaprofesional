export type ReportStatus = 'Aprobado' | 'En revisión' | 'Devuelto' | 'Pendiente';

export interface Report {
  name: string;
  code: string;
  status: ReportStatus;
  total: number;
  newCases: number;
  controls: number;
  alerts: number;
  sent: string;
}

export interface Establishment {
  code: string;
  name: string;
  type: 'Policlínico' | 'CIS' | 'UAPS';
}

export interface NavItem {
  label: string;
  icon: string;
  group: 'Operación' | 'Gestión';
  count?: number;
}

export interface ScreenMeta {
  eyebrow: string;
  title: string;
  description: string;
}

export type RoleId =
  | 'superadmin'
  | 'central-validator'
  | 'regional-superadmin'
  | 'regional-admin'
  | 'municipal-coordinator'
  | 'coordination-digitizer'
  | 'establishment-manager'
  | 'supervisor';

export interface RoleMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'green' | 'blue' | 'amber' | 'purple';
}

export interface RoleTask {
  title: string;
  detail: string;
  status: string;
  target?: string;
}

export interface RoleProfile {
  id: RoleId;
  roleName: string;
  userName: string;
  initials: string;
  scopeLabel: string;
  scopeDetail: string;
  privacyLabel: string;
  privacyDetail: string;
  dashboardMeta: ScreenMeta;
  navItems: string[];
  metrics: RoleMetric[];
  tasks: RoleTask[];
  permissions: string[];
  restrictions: string[];
  workflow: string[];
  primaryLabel: string;
  primaryTarget: string;
}
