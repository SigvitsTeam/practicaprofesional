# Decisión funcional: redes de salud — 4 de agosto de 2026

Este documento registra la incorporación de **Redes** como agrupación territorial y operativa dentro de una región sanitaria.

## Definición

Una Red permite asociar dos o más municipios de una misma región para consultar y trabajar su producción agregada.

Ejemplo inicial:

```text
Región de Cortés
└── Red Puerto Cortés–Omoa
    ├── Municipio de Puerto Cortés
    └── Municipio de Omoa
```

El nombre anterior es descriptivo para el prototipo y debe sustituirse por la denominación institucional oficial cuando sea confirmada.

## Cantidad inicial

Se ha indicado que la Región de Cortés posiblemente está organizada en **cinco redes**. La cantidad, nombres, códigos y composición de esas redes quedan pendientes de validación institucional antes de fijarlos como catálogo oficial.

El sistema no debe codificar permanentemente el número cinco: las redes serán configurables para permitir altas, modificaciones, activación, desactivación y cambios de composición.

## Capacidades funcionales

Para una Red y un período seleccionado se debe poder:

- Consolidar la producción agregada de sus municipios asociados.
- Filtrar dashboards, KPIs, reportes, tablas y mapas por Red.
- Desglosar resultados por municipio y, cuando los permisos lo permitan, por establecimiento.
- Exportar reportes de Red en Excel y PDF.
- Comparar redes de una misma región.
- Consultar cumplimiento, reportes pendientes, casos nuevos, controles, total ITS y demás indicadores agregados.
- Mantener trazabilidad de qué municipios formaban parte de la Red en cada período.

## Administración y permisos

### SuperAdmin

- Puede crear, editar, activar y desactivar redes en cualquier región.
- Puede asociar o retirar municipios de cualquier red.
- Puede gestionar nombres, códigos, vigencias y configuraciones.

### SuperAdmin Regional

- Puede crear, editar, activar y desactivar redes únicamente dentro de su región asignada.
- Puede asociar municipios de su región a sus redes.
- No puede incluir municipios de otra región ni administrar redes externas a su alcance.

### Admin Regional y perfiles de consulta

- Pueden consultar, consolidar, filtrar y exportar por Red según sus permisos.
- No gestionan la composición de las redes salvo que reciban un permiso administrativo explícito.

## Reglas

- Una Red pertenece a una sola región.
- Una Red agrupa municipios, no reemplaza la identidad ni el consolidado oficial de cada municipio.
- Las asociaciones Red–Municipio deben manejar vigencia de inicio y fin.
- Por defecto, un municipio tendrá una sola Red activa por programa y período; cualquier excepción requerirá definición institucional para evitar doble conteo.
- Un consolidado de Red usa datos agregados municipales y nunca concede acceso a ITS 1 individual.
- La Red es inicialmente una agrupación para análisis, consolidación, filtros y exportaciones; no agrega una etapa de aprobación al flujo institucional hasta que se solicite expresamente.
- Los totales deben evitar doble conteo cuando se comparen Red, región y municipios.

