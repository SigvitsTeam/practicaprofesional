# Decisiones vigentes del frontend — 3 de agosto de 2026

Este documento registra cambios funcionales indicados por el usuario durante la mañana del 3 de agosto de 2026.

Estas decisiones tienen precedencia sobre cualquier referencia anterior a AGI, doble mapa o captura ITS 1 exclusiva por un único establecimiento presente en otros documentos del proyecto.

## Alcance actual

- En esta etapa se desarrolla únicamente el frontend Angular.
- No se implementan persistencia, autorización real, consolidación de negocio ni acceso a base de datos.
- Las pantallas, estados, formularios y contratos de datos deben quedar preparados para conectarse posteriormente a NestJS.

## Digitador de coordinación

Existirá un usuario con rol de digitador de coordinación.

En el piloto de Puerto Cortés este usuario podrá:

- Seleccionar uno de los 12 establecimientos de salud.
- Capturar registros ITS 1 en nombre del establecimiento seleccionado.
- Consultar y editar los registros que correspondan al flujo de corrección autorizado.
- Generar o preparar el consolidado ITS 2 del establecimiento seleccionado.
- Enviar el ITS 2 a la bandeja de coordinación para revisión o supervisión.
- Atender las observaciones solicitadas por coordinación.
- Corregir la información necesaria y reenviar el reporte.

### Implicaciones para Angular

- La vista del digitador de coordinación debe incluir un selector de establecimiento claramente visible.
- El establecimiento seleccionado debe mostrarse como contexto activo en Captura ITS 1 y Reporte ITS 2.
- Al cambiar de establecimiento deben actualizarse los datos simulados, encabezados, registros recientes y resumen ITS 2.
- Las acciones de corrección deben mostrar estado, observaciones de supervisión e historial visible.
- El frontend puede simular estos cambios de contexto, pero el backend será posteriormente la autoridad de permisos, alcance y flujo.

## Catálogo real de establecimientos — actualización del 4 de agosto de 2026

Los 12 establecimientos reales pertenecientes a la Coordinación de Puerto Cortés están registrados en [catalogo-establecimientos-puerto-cortes.md](./catalogo-establecimientos-puerto-cortes.md).

Este catálogo sustituye los nombres y códigos provisionales utilizados anteriormente. El selector de establecimiento, la captura ITS 1, el reporte ITS 2, las bandejas, los consolidados y el mapa deben construirse utilizando exclusivamente dicho catálogo.

## Procedencia en ITS 1

Se elimina del alcance vigente:

- La pregunta "¿Pertenece al AGI?".
- La clasificación AGI / no AGI.
- La clasificación de procedencia externa.
- Los campos condicionales derivados de AGI.
- Los KPIs y filtros basados en AGI.

El Formulario ITS 1 utilizará únicamente:

```text
Procedencia
```

Será un campo de texto abierto donde el digitador escribirá manualmente la comunidad, barrio, colonia, dirección u otra referencia proporcionada.

### Implicaciones para Angular

- Mostrar un único campo abierto de procedencia.
- No intentar determinar automáticamente comunidad, cobertura o establecimiento asignado.
- No exigir catálogos territoriales para completar la captura.
- Se pueden mostrar ayudas de formato o ejemplos, pero no autocompletado obligatorio ni reglas AGI.

## Mapa operativo único

Se elimina el concepto de doble mapa de producción y cobertura AGI.

La aplicación tendrá un solo mapa interactivo.

### Comportamiento esperado

- El municipio de Puerto Cortés mostrará sus establecimientos mediante iconos geolocalizados.
- Cada icono tendrá un KPI asociado.
- El valor del KPI cambiará según los filtros activos.
- Los filtros podrán cambiar la métrica mostrada, por ejemplo casos totales, nuevos, controles, sexo, enfermedad u otra dimensión disponible.
- El usuario podrá interactuar con los marcadores para consultar el resumen del establecimiento.

### Navegación por niveles

- La coordinación municipal visualiza Puerto Cortés y sus establecimientos.
- La región puede visualizar sus municipios y acercarse a Puerto Cortés para ver sus establecimientos.
- Los niveles superiores usarán la misma dinámica de navegación y zoom, respetando su alcance.
- No se crearán mapas separados para cada nivel: se reutiliza el mismo componente de mapa con distinto alcance, centro, zoom, capas y datos.

### Implicaciones para Angular

- Construir un único componente reutilizable de mapa.
- Recibir por entradas el alcance territorial, centro, zoom, marcadores, métrica activa y filtros.
- Emitir eventos al seleccionar territorio o establecimiento.
- Mantener datos simulados en esta etapa y reservar la integración real para el API posterior.

## Reglas sustituidas

Cuando otro documento mencione alguno de los siguientes conceptos, debe aplicarse este documento:

```text
AGI / no AGI                       -> eliminado
Cobertura real / AGI               -> eliminado
Clasificación de procedencia       -> eliminado
Doble mapa                         -> reemplazado por mapa único
ITS 1 solo por establecimiento     -> ampliado al digitador de coordinación con selector
```
