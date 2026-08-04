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
