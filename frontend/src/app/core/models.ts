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
  type: 'CIS' | 'UAPS';
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
