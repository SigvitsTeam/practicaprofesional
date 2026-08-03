import { NavItem, Report, ScreenMeta } from './models';

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', icon: '⌂', group: 'Operación' },
  { label: 'Captura ITS 1', icon: '✚', group: 'Operación' },
  { label: 'Reporte ITS 2', icon: '▤', group: 'Operación' },
  { label: 'Bandeja de revisión', icon: '✓', group: 'Operación', count: 5 },
  { label: 'Consolidados', icon: '▦', group: 'Operación' },
  { label: 'Mapas', icon: '⌖', group: 'Operación' },
  { label: 'Reportes y exportaciones', icon: '⇩', group: 'Gestión' },
  { label: 'Administración', icon: '⚙', group: 'Gestión' },
];

export const SCREEN_META: Record<string, ScreenMeta> = {
  'Inicio': { eyebrow: 'COORDINACIÓN MUNICIPAL · PUERTO CORTÉS', title: 'Resumen epidemiológico', description: 'Seguimiento del período, cobertura y calidad de los reportes ITS.' },
  'Captura ITS 1': { eyebrow: 'DIGITACIÓN DE COORDINACIÓN · PUERTO CORTÉS', title: 'Captura de atención ITS 1', description: 'Registro para el establecimiento seleccionado por el digitador de coordinación.' },
  'Reporte ITS 2': { eyebrow: 'DIGITACIÓN DE COORDINACIÓN · PUERTO CORTÉS', title: 'Reporte mensual ITS 2', description: 'Consolidado del establecimiento activo, preparado para revisión de coordinación.' },
  'Bandeja de revisión': { eyebrow: 'COORDINACIÓN MUNICIPAL · PUERTO CORTÉS', title: 'Bandeja de revisión', description: 'Revisión de reportes ITS 2 agregados por establecimiento.' },
  'Consolidados': { eyebrow: 'COORDINACIÓN MUNICIPAL · PUERTO CORTÉS', title: 'Consolidado municipal', description: 'Seguimiento del flujo de aprobación y consolidación institucional.' },
  'Mapas': { eyebrow: 'ANÁLISIS TERRITORIAL · PUERTO CORTÉS', title: 'Mapa operativo ITS', description: 'Producción y procedencias registradas por establecimiento.' },
  'Reportes y exportaciones': { eyebrow: 'GESTIÓN DOCUMENTAL · PUERTO CORTÉS', title: 'Reportes y exportaciones', description: 'Generación y descarga auditada de informes oficiales.' },
  'Administración': { eyebrow: 'CONFIGURACIÓN · TERRITORIO', title: 'Administración territorial', description: 'Estructura sanitaria, cobertura y preparación operativa del piloto.' },
};

export const REPORTS: Report[] = [
  { name: 'CIS Cornelio Moncada Córdova', code: 'CIS-001', status: 'Aprobado', total: 31, newCases: 24, controls: 7, alerts: 0, sent: '25 jul, 09:42' },
  { name: 'CIS Medina', code: 'CIS-002', status: 'En revisión', total: 28, newCases: 21, controls: 7, alerts: 2, sent: '26 jul, 14:18' },
  { name: 'UAPS Cieneguita', code: 'UAPS-004', status: 'Devuelto', total: 17, newCases: 13, controls: 4, alerts: 3, sent: '24 jul, 11:05' },
  { name: 'UAPS Baracoa', code: 'UAPS-006', status: 'Pendiente', total: 0, newCases: 0, controls: 0, alerts: 0, sent: 'Sin envío' },
  { name: 'UAPS Río Mar', code: 'UAPS-008', status: 'Aprobado', total: 22, newCases: 17, controls: 5, alerts: 0, sent: '23 jul, 16:30' },
  { name: 'UAPS Travesía', code: 'UAPS-010', status: 'En revisión', total: 19, newCases: 14, controls: 5, alerts: 1, sent: '27 jul, 08:16' },
  { name: 'UAPS Bajamar', code: 'UAPS-003', status: 'Aprobado', total: 12, newCases: 9, controls: 3, alerts: 0, sent: '25 jul, 10:10' },
  { name: 'UAPS Chameleconcito', code: 'UAPS-005', status: 'Pendiente', total: 15, newCases: 11, controls: 4, alerts: 0, sent: 'Sin envío' },
  { name: 'UAPS Campana', code: 'UAPS-007', status: 'Aprobado', total: 10, newCases: 8, controls: 2, alerts: 0, sent: '24 jul, 13:25' },
  { name: 'UAPS Garífuna', code: 'UAPS-009', status: 'Aprobado', total: 11, newCases: 8, controls: 3, alerts: 0, sent: '26 jul, 11:40' },
  { name: 'UAPS El Chile', code: 'UAPS-011', status: 'Pendiente', total: 9, newCases: 7, controls: 2, alerts: 0, sent: 'Sin envío' },
  { name: 'UAPS Puente Alto', code: 'UAPS-012', status: 'Aprobado', total: 10, newCases: 8, controls: 2, alerts: 0, sent: '23 jul, 15:05' },
];
