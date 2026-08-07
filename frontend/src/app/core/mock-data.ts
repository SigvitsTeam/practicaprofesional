import { NavItem, Report, ScreenMeta } from './models';

export const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio', icon: '⌂', group: 'Operación' },
  { label: 'Captura ITS 1', icon: '✚', group: 'Operación' },
  { label: 'Reporte ITS 2', icon: '▤', group: 'Operación' },
  { label: 'Bandeja de revisión', icon: '✓', group: 'Operación', count: 5 },
  { label: 'Consolidados', icon: '▦', group: 'Operación' },
  { label: 'Mapas', icon: '⌖', group: 'Operación' },
  { label: 'Reportes y exportaciones', icon: '⇩', group: 'Gestión' },
  { label: 'Redes', icon: '⌘', group: 'Gestión' },
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
  'Redes': { eyebrow: 'AGRUPACIÓN TERRITORIAL · CORTÉS', title: 'Redes de salud', description: 'Consolidación, filtros y administración de municipios asociados.' },
  'Administración': { eyebrow: 'CONFIGURACIÓN · TERRITORIO', title: 'Administración territorial', description: 'Estructura sanitaria, cobertura y preparación operativa del piloto.' },
};

export const REPORTS: Report[] = [
  { name: 'Policlínico Cornelio Moncada Puerto Cortés', code: '2721', status: 'Aprobado', total: 31, newCases: 24, controls: 7, alerts: 0, sent: '25 jul, 09:42' },
  { name: 'CIS Linda Coello', code: '85481', status: 'En revisión', total: 28, newCases: 21, controls: 7, alerts: 2, sent: '26 jul, 14:18' },
  { name: 'UAPS La Pita', code: '2771', status: 'Devuelto', total: 17, newCases: 13, controls: 4, alerts: 3, sent: '24 jul, 11:05' },
  { name: 'CIS Bajamar', code: '2739', status: 'Pendiente', total: 0, newCases: 0, controls: 0, alerts: 0, sent: 'Sin envío' },
  { name: 'UAPS Travesia', code: '82899', status: 'Aprobado', total: 22, newCases: 17, controls: 5, alerts: 0, sent: '23 jul, 16:30' },
  { name: 'UAPS Saraguayna', code: '82881', status: 'En revisión', total: 19, newCases: 14, controls: 5, alerts: 1, sent: '27 jul, 08:16' },
  { name: 'CIS Fraternidad', code: '83453', status: 'Aprobado', total: 12, newCases: 9, controls: 3, alerts: 0, sent: '25 jul, 10:10' },
  { name: 'CIS Baracoa', code: '2747', status: 'Pendiente', total: 15, newCases: 11, controls: 4, alerts: 0, sent: 'Sin envío' },
  { name: 'UAPS Calan', code: '9563', status: 'Aprobado', total: 10, newCases: 8, controls: 2, alerts: 0, sent: '24 jul, 13:25' },
  { name: 'UAPS Puente Alto', code: '2780', status: 'Aprobado', total: 11, newCases: 8, controls: 3, alerts: 0, sent: '26 jul, 11:40' },
  { name: 'UAPS Caoba', code: '2755', status: 'Pendiente', total: 9, newCases: 7, controls: 2, alerts: 0, sent: 'Sin envío' },
  { name: 'UAPS Kele Kele', code: '2763', status: 'Aprobado', total: 10, newCases: 8, controls: 2, alerts: 0, sent: '23 jul, 15:05' },
];

/** Aggregated reports used above the municipal level. They intentionally keep
 * the same shape as ITS 2 reports so tables and review drawers cannot expose
 * individual ITS 1 records. */
export const MUNICIPAL_REPORTS: Report[] = [
  { name: 'Puerto Cortés', code: '0506', status: 'En revisión', total: 184, newCases: 139, controls: 45, alerts: 3, sent: '30 jul, 15:20' },
  { name: 'Omoa', code: '0503', status: 'Aprobado', total: 96, newCases: 72, controls: 24, alerts: 0, sent: '29 jul, 11:10' },
  { name: 'San Pedro Sula', code: '0501', status: 'Pendiente', total: 0, newCases: 0, controls: 0, alerts: 0, sent: 'Sin envío' },
  { name: 'Choloma', code: '0502', status: 'Pendiente', total: 0, newCases: 0, controls: 0, alerts: 0, sent: 'Sin envío' },
];

export const REGIONAL_REPORTS: Report[] = [
  { name: 'Región Sanitaria de Cortés', code: '05', status: 'En revisión', total: 280, newCases: 211, controls: 69, alerts: 2, sent: '02 ago, 09:35' },
  { name: 'Región Sanitaria de Atlántida', code: '01', status: 'Pendiente', total: 0, newCases: 0, controls: 0, alerts: 0, sent: 'Sin envío' },
  { name: 'Región Sanitaria de Francisco Morazán', code: '08', status: 'Pendiente', total: 0, newCases: 0, controls: 0, alerts: 0, sent: 'Sin envío' },
  { name: 'Región Sanitaria de Colón', code: '02', status: 'Pendiente', total: 0, newCases: 0, controls: 0, alerts: 0, sent: 'Sin envío' },
];
