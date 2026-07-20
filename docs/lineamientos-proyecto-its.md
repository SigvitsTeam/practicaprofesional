# Lineamientos del Proyecto ITS

## Vision general

El proyecto busca automatizar la captura, consolidacion, revision, exportacion y analisis de informes del programa ITS, iniciando como piloto en Puerto Cortes, pero con una arquitectura preparada para escalar a otros municipios, regiones y nivel nacional.

Principio rector:

> El dato individual nace y permanece en el establecimiento de salud. La informacion consolidada fluye por municipio, region y nivel central hasta generar el reporte nacional.

Documento tecnico asociado:

- `docs/modelo-base-datos-its.md`: modelo de base de datos propuesto para desarrollo.

## Stack tecnologico acordado

- Frontend: Angular.
- Backend: NestJS sobre Node.js.
- Base de datos: Supabase PostgreSQL.
- Mapas: Leaflet.
- Graficas: ECharts o Chart.js.
- Exportacion Excel: ExcelJS.
- Exportacion PDF: conversion desde plantillas Excel, preferiblemente con LibreOffice headless u otro servicio controlado.
- Control de versiones: Git/GitHub.
- Criterios de desarrollo: Clean Code y SOLID.

Regla tecnica principal:

```text
Angular = interfaz y experiencia de usuario.
NestJS = autoridad de reglas de negocio.
Supabase PostgreSQL = persistencia y catálogos.
```

No se recomienda que Angular opere directamente sobre Supabase para procesos criticos. Toda regla institucional, validacion sensible, consolidacion, auditoria, flujo de aprobacion y exportacion debe pasar por NestJS.

## Alcance funcional completo

- Administracion de regiones, municipios y establecimientos.
- Administracion de usuarios, roles y permisos.
- Captura del Form. ITS 1 por establecimiento de salud.
- Generacion automatica del Form. ITS 2 por establecimiento.
- Revision municipal de consolidados ITS 2.
- Consolidado municipal.
- Revision regional.
- Consolidado regional.
- Revision de nivel central.
- Consolidado nacional.
- Exportacion Excel y PDF en formatos oficiales.
- Mapas por establecimiento segun captacion.
- Mapas por procedencia real del paciente.
- Identificacion de casos de fuera del municipio.
- Reportes mensuales, por semana epidemiologica, trimestrales, semestrales y anuales.
- Evaluacion anual ITS en formato general y comparativo.
- Rankings, comparativos y dashboards.
- Auditoria de acciones sensibles.
- Versionamiento de reportes enviados.

## Flujo institucional

```text
Establecimiento -> Coordinacion Municipal -> Region -> Nivel Central -> Reporte Nacional
```

### Establecimiento

- Captura ITS 1.
- Consulta y corrige ITS 1 de su propio establecimiento mientras el reporte este en estado editable.
- Genera ITS 2 del establecimiento.
- Registra o carga mensualmente el total de atenciones por rangos de edad requerido para indicadores comparativos.
- Envia ITS 2 a coordinacion municipal.

### Coordinacion Municipal

- No accede a ITS 1 individual.
- Revisa ITS 2 de establecimientos.
- Devuelve reportes con observaciones si detecta inconsistencias.
- Aprueba reportes de establecimientos.
- Consolida ITS 2 municipal.
- Envia consolidado municipal a region.

### Region

- No accede a ITS 1 individual.
- Revisa consolidados municipales y reportes agregados.
- Devuelve a municipio si detecta inconsistencias.
- Aprueba consolidado municipal.
- Genera consolidado regional.
- Envia consolidado regional a nivel central.

### Nivel Central

- No accede a ITS 1 individual.
- Revisa consolidados regionales.
- Devuelve a region si detecta inconsistencias.
- Aprueba consolidados regionales.
- Genera consolidado nacional.

### SuperAdmin

- Administra estructura del sistema, no sustituye al nivel central.
- Gestiona regiones, municipios, establecimientos, usuarios, roles, permisos, catálogos, plantillas, semanas epidemiologicas y configuraciones.
- Puede realizar reaperturas o acciones excepcionales con motivo obligatorio y auditoria.

## Privacidad por diseno

ITS 1 contiene datos individuales y sensibles. Solo debe estar disponible para el establecimiento que lo captura y para usuarios autorizados dentro del alcance del establecimiento.

Los niveles municipal, regional y central solo deben acceder a informacion consolidada ITS 2 o agregada.

Restricciones clave:

- No exponer numero de expediente o ID de paciente a niveles superiores.
- No exponer registros individuales en reportes municipales, regionales o nacionales.
- Aplicar supresion o agrupacion cuando los mapas/reportes puedan identificar personas por conteos muy bajos.
- Registrar en auditoria toda exportacion, correccion, envio, aprobacion, devolucion o reapertura.

## Roles propuestos

- SuperAdmin.
- Admin Central o Validador Central.
- Admin Regional.
- Coordinador Municipal.
- Responsable de Establecimiento.
- Digitador de Establecimiento.
- Supervisor o Consulta.

Los permisos deben combinar:

```text
Rol + alcance territorial + nivel de dato permitido
```

Ejemplo:

```text
Digitador:
- alcance: establecimiento.
- dato permitido: ITS 1 propio e ITS 2 propio.

Coordinador Municipal:
- alcance: municipio.
- dato permitido: ITS 2 agregado.

Admin Regional:
- alcance: region.
- dato permitido: ITS 2 agregado.

Nivel Central:
- alcance: nacional.
- dato permitido: consolidados regionales y nacional.

SuperAdmin:
- alcance: sistema.
- dato permitido: configuracion, catálogos y acciones excepcionales auditadas.
```

## Estados de reportes

Estados sugeridos:

```text
BORRADOR
ENVIADO_A_MUNICIPIO
DEVUELTO_POR_MUNICIPIO
APROBADO_MUNICIPIO
ENVIADO_A_REGION
DEVUELTO_POR_REGION
APROBADO_REGION
ENVIADO_A_CENTRAL
DEVUELTO_POR_CENTRAL
APROBADO_CENTRAL
CONSOLIDADO_NACIONAL
CERRADO_OFICIAL
REABIERTO_AUTORIZADO
```

En interfaz se pueden mostrar nombres mas simples:

```text
Borrador
En revision
Devuelto
Aprobado
Cerrado
```

Cada cambio de estado debe guardar usuario, fecha, estado anterior, estado nuevo y comentario cuando aplique.

## Correcciones

- Antes de enviar, el establecimiento puede corregir ITS 1.
- Si municipio devuelve, el establecimiento corrige ITS 1 y reenvia ITS 2.
- Si region devuelve, el municipio revisa y puede devolver al establecimiento correspondiente.
- Si central devuelve, region revisa y puede devolver a municipio.
- Despues del cierre oficial, solo se permite reapertura autorizada con motivo obligatorio y auditoria.

Los niveles superiores no corrigen ITS 1 individual.

## Captura ITS 1

Campos implicitos por usuario y periodo:

- Region.
- Municipio.
- Establecimiento.
- Codigo de establecimiento.
- Responsable.
- Usuario que registra.
- Fecha y hora de digitacion.

Campos de captura:

- Fecha de atencion.
- Numero de expediente o ID paciente.
- Procedencia declarada.
- Sexo: Hombre o Mujer.
- Edad.
- Tipo de poblacion: General o Trabajador(a) sexual.
- Contacto: si/no.
- Embarazada: si/no.
- Clasificacion de enfermedad.
- Enfermedad.
- Tipo de caso: Nuevo o Control.

Reglas:

- La semana epidemiologica se calcula desde la fecha de atencion.
- Mes, trimestre, semestre y anio se derivan de la fecha de atencion.
- Embarazada solo aplica para sexo Mujer.
- Las enfermedades deben filtrarse y validarse segun aplicabilidad por sexo.
- Una atencion puede tener mas de un diagnostico.
- Deben existir alertas de posibles duplicados.

## Informe mensual del establecimiento

El informe mensual del establecimiento no debe limitarse al consolidado ITS 2. Tambien debe solicitar la informacion de total de atenciones necesaria para indicadores comparativos y tasas.

Al preparar el envio mensual, el establecimiento debe completar o cargar:

- ITS 2 mensual generado desde ITS 1.
- Total de atenciones en menores de 15 anios.
- Total de atenciones en mayores o iguales de 15 anios, segun definicion institucional.
- Fuente del total de atenciones.
- Observaciones, si aplica.

Flujo recomendado:

```text
Captura ITS 1 -> Generacion ITS 2 -> Carga de total de atenciones -> Validacion de calidad -> Envio a municipio
```

Reglas:

- El sistema debe advertir si falta total de atenciones antes de enviar.
- La institucion debe definir si la falta de atenciones bloquea el envio o permite envio con estado pendiente.
- Si se permite envio pendiente, el reporte debe marcarse como incompleto para indicadores de tasa.
- Las tasas mensuales, anuales o comparativas solo deben calcularse cuando existan denominadores validos.
- El total de atenciones debe poder cargarse por formulario o importarse desde Excel.
- La carga puede corregirse antes del cierre, y despues del cierre solo mediante flujo de devolucion o reapertura autorizada.

Estados sugeridos del componente de atenciones dentro del reporte mensual:

```text
SIN_CARGA
PARCIAL
COMPLETO
VALIDADO
OBSERVADO
```

## Catalogo de enfermedades ITS

Clasificaciones:

- Sindromico.
- Clinico.
- C/E.
- Etiologico.

Cada enfermedad debe tener:

- Nombre.
- Clasificacion.
- Codigo opcional.
- Aplica a hombre.
- Aplica a mujer.
- Orden en formato oficial.
- Estado activo/inactivo.

## Geografia y procedencia

Se deben distinguir dos conceptos:

```text
Establecimiento de atencion != procedencia real del paciente
```

Cada atencion debe registrar:

- Establecimiento que atendio.
- Procedencia textual original.
- Si la procedencia pertenece al AGI del establecimiento que atiende.
- Clasificacion de procedencia externa cuando no pertenece al AGI.
- Comunidad/barrio/colonia normalizada, si existe catalogo disponible.
- Municipio de procedencia, si aplica.
- Departamento de procedencia, si aplica.
- Pais de procedencia, si aplica.
- Establecimiento de cobertura asignado segun procedencia, cuando exista informacion territorial suficiente.
- Si viene de fuera del municipio.
- Si viene de otro departamento.
- Si es extranjero.

Mapas definidos:

1. Mapa por establecimiento segun captacion.
2. Mapa por procedencia real del paciente.
3. Panel o mapa de procedencias externas al municipio.

La procedencia debe usar autocompletado, alias y una bandeja de procedencias no reconocidas.

### AGI del establecimiento

Para evitar depender desde el inicio de un listado completo y validado de comunidades por establecimiento, el Form. ITS 1 debe incluir una validacion directa junto al campo de procedencia:

```text
¿Pertenece al AGI de este establecimiento?
Si / No
```

Si la respuesta es "Si":

- El caso forma parte de la produccion total del establecimiento.
- El caso tambien forma parte de la cobertura real/AGI del establecimiento.

Si la respuesta es "No":

- El caso forma parte de la produccion total del establecimiento.
- El caso no forma parte de la cobertura real/AGI del establecimiento.
- El usuario debe clasificar la procedencia externa.

Clasificaciones sugeridas cuando no pertenece al AGI:

```text
Otro establecimiento del mismo municipio
Otro municipio del mismo departamento/region
Otro departamento
Extranjero
Desconocido / no especificado
```

Campos condicionales sugeridos:

- Municipio de procedencia.
- Departamento de procedencia.
- Pais de procedencia.
- Observacion de procedencia.

Regla conceptual:

```text
Produccion total = todos los pacientes atendidos por el establecimiento.
Cobertura real/AGI = pacientes que el establecimiento marca como pertenecientes a su AGI.
```

El catalogo de comunidades, barrios y colonias puede seguir existiendo como mejora futura o como apoyo de normalizacion, pero no debe ser requisito bloqueante para iniciar el piloto.

### Tarjetas de procedencia y AGI

La clasificacion de AGI/procedencia externa debe mostrarse tambien como tarjetas o KPIs, no solo en tablas o mapas.

Tarjetas sugeridas a nivel de establecimiento:

- Produccion total atendida.
- Casos pertenecientes al AGI.
- Casos no pertenecientes al AGI.
- Casos de otro establecimiento del mismo municipio.
- Casos de otro municipio del mismo departamento/region.
- Casos de otro departamento.
- Casos extranjeros.
- Casos con procedencia desconocida/no especificada.

Cada tarjeta debe responder a los filtros activos:

- Mes.
- Semana epidemiologica.
- Anio.
- Sexo.
- Edad o grupo de edad.
- Enfermedad.
- Clasificacion.
- Tipo de caso.
- Tipo de poblacion.
- Contacto.
- Embarazada.

Ejemplo:

```text
Filtro: Sexo = Hombre, periodo = Julio 2027
Tarjeta "Casos no AGI" muestra solo hombres atendidos en el establecimiento que no pertenecen a su AGI.
```

Para niveles superiores, las tarjetas deben mostrarse agregadas:

Municipio:

- Produccion total de establecimientos.
- Casos AGI.
- Casos no AGI.
- Casos captados de otros municipios.
- Casos externos al departamento.
- Casos extranjeros.

Region:

- Totales por municipio.
- Municipios con mayor proporcion de casos no AGI.
- Casos provenientes de otros departamentos.
- Casos extranjeros.

Nivel Central:

- Totales nacionales.
- Totales por region.
- Regiones con mayor proporcion de atenciones externas.
- Casos extranjeros agregados.

Estas tarjetas deben respetar la regla de privacidad: niveles superiores consumen informacion agregada, no ITS 1 individual.

### Mapas por nivel institucional

Los mapas deben respetar el alcance territorial y el rol del usuario.

```text
Establecimiento -> mapa de su establecimiento y area de cobertura asignada.
Coordinacion Municipal -> mapa de su municipio.
Region -> mapa del departamento/region bajo su responsabilidad.
Nivel Central -> mapa nacional.
SuperAdmin -> puede administrar y visualizar todos los niveles segun necesidad tecnica.
```

Ejemplo:

```text
Usuario de Puerto Cortes -> solo visualiza Puerto Cortes.
Usuario regional de Cortes -> visualiza el departamento/region de Cortes.
Usuario de nivel central -> visualiza Honduras completo.
```

El mapa debe generarse desde los objetos geograficos administrados en el sistema, no desde condiciones quemadas en codigo.

Objetos administrables:

- Pais.
- Region/departamento.
- Municipio.
- Establecimiento de salud.
- Comunidad, barrio, colonia, aldea o caserio.
- Area de cobertura.

Cuando se crea un nuevo establecimiento, municipio o region, el sistema debe permitir registrar su ubicacion o geometria para que aparezca automaticamente en los mapas correspondientes.

### Activacion progresiva del mapa por estructura creada

El mapa debe activarse progresivamente segun la estructura institucional que exista y este operativa en el sistema.

Secuencia inicial prevista:

```text
1. Ingresan SuperAdmin y Nivel Central.
2. Nivel Central visualiza el mapa nacional de Honduras con sus 18 departamentos/regiones disponibles como base geografica.
3. Nivel Central crea la primera region operativa: Region Sanitaria Departamental de Cortes, posiblemente Region No. 5 segun validacion institucional.
4. Al crear y activar la region, el mapa de Cortes queda habilitado a nivel central y para usuarios regionales asignados.
5. La Region de Cortes crea la Coordinacion Municipal de Salud de Puerto Cortes.
6. Al crear y activar Puerto Cortes, el mapa municipal queda habilitado para nivel central, nivel regional y coordinacion municipal.
7. La Coordinacion Municipal de Puerto Cortes crea sus 12 establecimientos de salud.
8. Cada establecimiento recibe accesos y queda habilitado para capturar ITS 1 y generar ITS 2.
```

La base geografica nacional puede existir previamente como referencia, pero un territorio solo debe considerarse operativo cuando:

- Esta creado en la estructura institucional del sistema.
- Esta activo.
- Tiene responsables o accesos asignados.
- Tiene datos geograficos minimos registrados o asociados.

Estados sugeridos para objetos territoriales:

```text
PRECONFIGURADO
CREADO
ACTIVO
INACTIVO
EN_PILOTAJE
```

Reglas:

- Nivel Central puede ver el mapa nacional completo como contexto.
- Los departamentos/regiones no operativos pueden mostrarse como referencia, pero sin KPIs operativos.
- Una region activa habilita su mapa regional.
- Un municipio/coordinacion activa habilita su mapa municipal.
- Los establecimientos activos aparecen como marcadores del municipio correspondiente.
- Solo los objetos activos participan en reportes operativos, KPIs y flujo de notificacion.

Ejemplo del piloto:

```text
Pais: Honduras.
Region activa inicial: Region Sanitaria Departamental de Cortes.
Municipio/coordinacion activa inicial: Puerto Cortes.
Establecimientos activos iniciales: 12 establecimientos de Puerto Cortes.
```

Se debe validar institucionalmente si "Region Sanitaria Departamental de Cortes" corresponde oficialmente a la Region No. 5 antes de fijar ese codigo en catalogos.

### Capas y objetos del mapa

Los mapas deben manejar capas activables segun nivel:

- Limites nacionales.
- Limites regionales/departamentales.
- Limites municipales.
- Comunidades/barrios/colonias.
- Establecimientos de salud.
- Casos por captacion.
- Casos por procedencia.
- Procedencias externas.
- Areas de cobertura.

Los establecimientos deben mostrarse como objetos del mapa, por ejemplo marcadores, iconos o simbolos, con informacion dinamica segun filtros.

Cada objeto de establecimiento debe poder mostrar:

- Nombre del establecimiento.
- Codigo.
- Tipo.
- Total de casos segun filtro activo.
- Casos nuevos.
- Controles.
- Total de atenciones, si aplica.
- Tasa por 1000, si existe denominador.
- Alertas de calidad o reporte pendiente, si aplica.

### Filtros geograficos dinamicos

Los mapas deben actualizar sus indicadores segun filtros seleccionados.

Filtros sugeridos:

- Periodo mensual.
- Semana epidemiologica.
- Trimestre.
- Semestre.
- Anio.
- Sexo.
- Edad o grupo de edad.
- Menor/mayor de 15 anios.
- Enfermedad.
- Clasificacion.
- Tipo de caso: nuevo/control.
- Tipo de poblacion.
- Contacto.
- Embarazada.
- Establecimiento.
- Municipio.
- Region.
- Procedencia interna/externa.

Ejemplo:

```text
Filtro: Sexo = Hombre
Mapa municipal de Puerto Cortes:
- cada establecimiento muestra cuantos hombres con ITS fueron captados.
```

### KPIs por nivel

Ademas de marcadores, cada nivel debe mostrar KPIs adecuados:

Establecimiento:

- Total de casos ITS.
- Nuevos.
- Controles.
- Casos por sexo.
- Casos por enfermedad.
- Total de atenciones cargadas.

### Mapas a nivel de establecimiento

Cada establecimiento debe contar con al menos dos vistas de mapa.

Ejemplo:

```text
Establecimiento: CIS Cornelio Moncada Cordova.
Municipio: Puerto Cortes.
Region: Cortes.
Pais: Honduras.
```

#### 1. Mapa de produccion total del mes

Muestra toda la produccion captada por el establecimiento durante el periodo seleccionado, independientemente de si los pacientes pertenecen o no a su area de cobertura.

Este mapa responde:

```text
¿Cuanto atendio este establecimiento?
```

Debe incluir:

- Total de casos atendidos por el establecimiento.
- Casos por procedencia real.
- Casos de comunidades propias.
- Casos de comunidades de otros establecimientos.
- Casos fuera del municipio, si existen.
- Filtros por mes, semana epidemiologica, sexo, edad, enfermedad, poblacion y tipo de caso.

#### 2. Mapa de cobertura real del establecimiento

Muestra los casos cuya procedencia fue marcada como perteneciente al AGI del establecimiento.

Este mapa responde:

```text
¿Que esta ocurriendo en el territorio que le corresponde cubrir a este establecimiento?
```

Debe incluir:

- Casos marcados como pertenecientes al AGI.
- Procedencias textuales declaradas dentro del AGI.
- Casos atendidos por el propio establecimiento.
- Total por procedencia declarada o comunidad normalizada, si existe.
- Filtros dinamicos.

Regla conceptual:

```text
Produccion total = lo que el establecimiento atendio.
Cobertura real = lo que ocurre en las comunidades que le corresponden.
```

Esto permite diferenciar productividad operativa de situacion epidemiologica del area asignada.

Municipio:

- Total municipal.
- Totales por establecimiento.
- Establecimientos con mayor captacion.
- Procedencias principales.
- Casos fuera de area.

Region:

- Totales por municipio.
- Ranking de municipios.
- Municipios pendientes de reporte.
- Tendencias por semana o mes.

Nivel Central:

- Totales por region/departamento.
- Ranking regional.
- Consolidado nacional.
- Regiones pendientes de cierre.

### Agregacion y privacidad en mapas

Los mapas de niveles superiores deben trabajar con datos agregados.

Regla:

```text
Municipio, region y nivel central no acceden a ITS 1 individual desde los mapas.
```

Las consultas del mapa deben consumir endpoints agregados, por ejemplo:

```text
/mapas/municipal/resumen-establecimientos
/mapas/regional/resumen-municipios
/mapas/nacional/resumen-regiones
```

La politica de conteos bajos y privacidad queda pendiente de definicion institucional, pero el diseno debe permitir aplicar reglas de supresion o agrupacion.

### Mejoras geograficas aprobadas

Se incorporan las siguientes mejoras para robustecer el modulo geografico:

1. Catalogo geografico precargado.
   - Cargar Honduras, sus departamentos/regiones y municipios como base geografica de referencia, aunque no todos esten operativos.

2. Separacion entre mapa base y mapa operativo.
   - Mapa base: referencia territorial.
   - Mapa operativo: territorios activos con usuarios, reportes y KPIs.

3. Estados operativos por territorio.
   - Estados sugeridos: PRECONFIGURADO, CREADO, EN_PILOTAJE, ACTIVO, INACTIVO, SUSPENDIDO.

4. Asistente de activacion territorial.
   - Al crear region, municipio/coordinacion o establecimiento, guiar al usuario por datos generales, ubicacion, accesos, validaciones y activacion.

5. Validacion visual de coordenadas por coordinacion.
   - La coordinacion correspondiente debe validar visualmente la ubicacion de sus establecimientos en el mapa antes de activarlos plenamente.
   - El sistema debe mostrar un mapa de confirmacion para evitar guardar coordenadas incorrectas.

6. Historial territorial.
   - Registrar cambios de nombre, codigo, cobertura, municipio asignado, estado y datos geograficos.
   - Los reportes historicos deben conservar interpretacion correcta aunque la estructura cambie.

7. Versionamiento de coberturas.
   - Las comunidades asignadas a establecimientos deben poder cambiar por vigencia.
   - Ejemplo: una comunidad pertenece a un establecimiento hasta cierta fecha y luego a otro.

8. Bandeja de territorios incompletos.
   - Mostrar regiones sin geometria, municipios sin responsable, establecimientos sin coordenadas, comunidades sin cobertura y usuarios sin alcance asignado.

9. Capas de mapa configurables.
   - Activar/desactivar establecimientos, municipios, comunidades, coberturas, procedencias externas, captacion y procedencia real.

10. KPIs contextuales.
   - Nivel central: KPIs por region.
   - Region: KPIs por municipio.
   - Municipio: KPIs por establecimiento.
   - Establecimiento: KPIs propios.

11. Cache de mapas y KPIs.
   - Preparar consultas frecuentes para mejor rendimiento, especialmente a nivel regional y nacional.

12. Vistas materializadas o consolidados congelados.
   - Usar agregados precalculados para reportes cerrados y mapas historicos.

13. Importacion geografica.
   - Permitir carga de GeoJSON, CSV con coordenadas o Excel de establecimientos/comunidades/coberturas.

14. Normalizacion de nombres y alias.
   - Gestionar variantes de barrios, colonias, comunidades y establecimientos.

15. Modo solo lectura nacional.
   - Nivel central puede ver territorios no operativos como referencia, sin KPIs ni flujo operativo.

16. Alertas geograficas.
   - Detectar establecimientos sin coordenadas, comunidades sin cobertura, pacientes fuera de area, aumentos inusuales y reportes pendientes.

17. Privacidad geografica configurable.
   - Preparar reglas por rol/nivel para conteos bajos, agrupacion u ocultamiento segun validacion institucional.

18. Preparacion para vector tiles.
   - No implementar necesariamente al inicio, pero disenar datos para poder migrar de GeoJSON simple a vector tiles si escala.

19. Auditoria de consultas sensibles.
   - Auditar exportaciones o consultas sensibles de mapas y reportes filtrados.

20. Manual de gobernanza de datos.
   - Documentar quien puede crear, activar, corregir, cerrar o reabrir territorios, usuarios, reportes y datos historicos.

## Semanas epidemiologicas

La fecha de atencion debe ser obligatoria.

Tabla sugerida:

```text
semanas_epidemiologicas
- id
- anio
- numero_semana
- fecha_inicio
- fecha_fin
- activa
```

Los reportes deben poder generarse por:

- Semana epidemiologica.
- Mes.
- Trimestre.
- Semestre.
- Anio.

## Exportaciones

Las plantillas oficiales en Excel deben usarse como fuente maestra.

El sistema debe permitir:

- Exportar ITS 1 en Excel para el establecimiento.
- Exportar ITS 2 en Excel.
- Exportar ITS 2 en PDF.
- Guardar historial de reportes generados.
- Guardar version de plantilla utilizada.

## Evaluacion anual ITS

Se incorpora como requisito la visualizacion, generacion e impresion de formatos anuales de evaluacion ITS, tomando como referencia el archivo oficial con las hojas:

- INFORME.
- COMPARATIVO.

### Informe anual general

El informe anual general muestra el consolidado de casos ITS/VIH-SIDA por:

- Establecimiento o municipio, segun nivel.
- Total de casos nuevos.
- Total de controles.
- Sexo.
- Enfermedades ITS segun clasificacion:
  - Sindromico.
  - Clinico.
  - C/E.
  - Etiologico.

Este informe debe generarse desde los consolidados del sistema, respetando el nivel de acceso del usuario:

```text
Establecimiento -> su propio informe.
Municipio -> establecimientos de su municipio y total municipal.
Region -> municipios/establecimientos segun consolidado regional permitido.
Nivel Central -> consolidados regionales y nacional.
```

Los niveles superiores no deben acceder a ITS 1 individual para construir este informe; deben consumir datos agregados.

### Comparativo anual

El comparativo anual debe permitir comparar el anio actual contra el anio anterior.

Indicadores identificados:

- Total de atenciones en menores de 15 anios.
- Numero de casos ITS en menores de 15 anios.
- Tasa por 1000 atenciones en menores de 15 anios.
- Total de atenciones en mayores de 15 anios.
- Numero de casos ITS en mayores de 15 anios.
- Tasa por 1000 atenciones en mayores de 15 anios.

Formula del indicador:

```text
Tasa ITS x 1000 = (No. casos ITS / Total de atenciones) * 1000
```

La tasa debe calcularse desde el sistema, no digitarse manualmente, cuando existan numeradores y denominadores.

### Datos historicos, linea base y anio anterior

Para el comparativo, el sistema debe poder usar datos del anio anterior. Si el sistema aun no contiene esa informacion historica, debe permitir:

- Digitar datos historicos.
- Importar datos historicos desde Excel.
- Marcar esos datos como fuente historica/importada.
- Guardar usuario, fecha, archivo fuente y observaciones de carga.
- Validar totales antes de aceptar la carga.
- Evitar mezclar datos capturados en el sistema con datos historicos sin identificar su origen.

Ejemplo:

```text
Si se genera comparativo 2026 vs 2025 y el sistema no tiene 2025,
se debe permitir cargar/digitar el 2025 como linea base historica.
```

El anio historico no debe estar fijo. Debe ser configurable segun la entrada oficial del sistema.

Escenario previsto:

```text
Si el pilotaje se realiza en 2026 y la entrada oficial inicia en 2027,
el sistema debe permitir cargar o consolidar 2026 como linea base historica
para comparar 2027 vs 2026.
```

Tambien debe permitir que 2026 tenga origen mixto:

- Datos capturados durante pilotaje en el sistema.
- Datos importados desde Excel.
- Datos digitados manualmente como historicos.

En caso de origen mixto, cada dato debe conservar su fuente para auditoria y trazabilidad.

### Denominadores externos: total de atenciones

El comparativo requiere total de atenciones por grupo de edad. Estos valores pueden no provenir del modulo ITS, por lo que deben manejarse como una fuente de datos adicional.

El sistema debe solicitar, permitir cargar y permitir complementar posteriormente la informacion de total de atenciones por rangos de edad.

Requisitos:

- Permitir carga desde Excel.
- Permitir digitacion manual.
- Permitir carga parcial y completado posterior.
- Marcar registros como completos, incompletos o pendientes de validacion.
- Validar que existan denominadores antes de calcular tasas.
- Si falta el denominador, mostrar la tasa como pendiente/no calculable.
- Notificar o advertir al usuario cuando falten atenciones para un establecimiento, municipio, periodo o anio.
- Registrar fuente, usuario, fecha y observaciones de carga.

Se debe definir una estructura para indicadores de produccion o total de atenciones:

```text
atenciones_produccion
- periodo/anio
- nivel
- region_id
- municipio_id
- establecimiento_id
- grupo_edad_comparativo
- total_atenciones
- fuente
- es_historico
- estado_carga
- observaciones
- creado_por
- created_at
```

Grupos minimos:

- Menor de 15 anios.
- Mayor o igual de 15 anios, segun lineamiento institucional.

La definicion exacta de mayor de 15 debe validarse con el formato oficial y la institucion, porque en el archivo aparece expresado como mayor de 15 anios.

Estados sugeridos para la carga de total de atenciones:

```text
PENDIENTE
PARCIAL
COMPLETA
VALIDADA
OBSERVADA
```

Regla de calculo:

```text
Si total_atenciones es nulo o cero, no calcular tasa automaticamente.
El sistema debe mostrar pendiente o no calculable y pedir completar/validar el dato.
```

### Exportacion e impresion

Los reportes anuales deben poder:

- Visualizarse en pantalla.
- Exportarse en Excel usando plantilla oficial.
- Exportarse o imprimirse en PDF.
- Generarse por nivel autorizado.
- Guardar historial de versiones.
- Indicar anio actual, anio comparado y fuente de datos historicos.

## Lineamientos Clean Code y SOLID

### Clean Code

- Nombres claros.
- Funciones pequenas.
- Servicios con responsabilidad especifica.
- DTOs validados.
- Errores controlados.
- Nada de logica critica en componentes Angular.
- Nada de reglas de negocio dispersas en SQL, Angular y backend sin control.
- Migraciones ordenadas.
- Seeds para catálogos.
- Pruebas para reglas criticas.

### SOLID

- Single Responsibility: cada modulo tiene una responsabilidad clara.
- Open/Closed: nuevos reportes, plantillas o niveles no deben exigir reescritura masiva.
- Liskov Substitution: los distintos consolidados deben comportarse como reportes consolidables.
- Interface Segregation: evitar servicios gigantes.
- Dependency Inversion: la logica depende de abstracciones, no directamente de ExcelJS, Supabase o librerias especificas.

## Modulos sugeridos en NestJS

- AuthModule.
- UsersModule.
- RolesPermissionsModule.
- TerritorialModule.
- FacilitiesModule.
- CommunitiesModule.
- CatalogsModule.
- EpidemiologicalWeeksModule.
- ItsCaptureModule.
- DiagnosticsModule.
- ReportsModule.
- ConsolidationModule.
- WorkflowModule.
- ExportsModule.
- MapsModule.
- AuditModule.

## Modulos sugeridos en Angular

- core.
- shared.
- features/auth.
- features/admin.
- features/catalogs.
- features/territorial.
- features/its-capture.
- features/reports.
- features/workflow.
- features/maps.
- features/exports.
- features/dashboard.

## Oportunidades de mejora identificadas

- Formalizar reportes enviados como versiones congeladas.
- Crear bandejas de revision por nivel.
- Crear bandeja de procedencias no reconocidas.
- Aplicar reglas de supresion de conteos bajos en mapas y reportes.
- Agregar indicadores de calidad antes de enviar.
- Agregar alertas de posibles duplicados.
- Separar SuperAdmin tecnico de Nivel Central institucional.
- Mantener el sistema preparado para nuevos programas de salud, no solo ITS.
- Diseñar exportaciones con estrategia intercambiable: Excel y PDF.
- Preparar pruebas unitarias para consolidacion, permisos, validaciones clinicas y flujo de estados.

## Mejoras aprobadas para incorporar al diseno

### 1. Matriz formal de permisos

Se debe construir una matriz de permisos que defina, por cada rol:

- Modulos disponibles.
- Acciones permitidas.
- Alcance territorial.
- Nivel de dato permitido.
- Restricciones por estado del reporte.

La matriz debe evitar reglas implicitas o dispersas en el codigo.

Ejemplo de dimensiones:

```text
rol + modulo + accion + alcance + nivel_dato + estado_reporte
```

### 2. Diccionario de datos

El proyecto debe contar con un diccionario de datos que documente:

- Nombre del campo.
- Descripcion.
- Tipo de dato.
- Tabla o entidad.
- Si es obligatorio.
- Si es sensible.
- Reglas de validacion.
- Roles que pueden verlo.
- Roles que pueden modificarlo.
- Si se captura, se calcula o se deriva.

Este diccionario debe servir como insumo para desarrollo, pruebas y documentacion de tesis.

### 3. Reglas de calidad antes del envio

Antes de enviar un reporte al siguiente nivel, el sistema debe ejecutar validaciones de calidad.

Validaciones sugeridas:

- Registros incompletos.
- Procedencias no reconocidas.
- Posibles duplicados.
- Diagnosticos no validos por sexo.
- Diagnosticos con alertas por edad.
- Variaciones inusuales contra periodos anteriores.
- Establecimientos sin registros o sin reporte.
- Reportes enviados fuera de fecha.

Estas reglas deben generar advertencias y, segun criticidad, bloquear o permitir envio con justificacion.

### 4. Versionamiento de reportes

Todo reporte enviado debe quedar congelado como version oficial.

Reglas:

- Un reporte en borrador puede recalcularse.
- Un reporte enviado debe guardar su detalle consolidado.
- Si se corrige informacion despues del envio, se debe generar una nueva version.
- Cada version debe guardar usuario, fecha, estado, plantilla usada y motivo si aplica.

Esto aplica para consolidados de establecimiento, municipio, region y nacional.

### 5. Privacidad en mapas y reportes agregados

Se debe considerar una politica de privacidad para mapas y reportes agregados, especialmente cuando los filtros puedan mostrar conteos bajos por barrio, colonia, comunidad, diagnostico o semana epidemiologica.

Estado: pendiente de validacion institucional.

Opciones a evaluar:

- Mostrar conteos exactos solo a ciertos roles.
- Agrupar conteos bajos.
- Mostrar "menos de N" cuando el total sea bajo.
- Deshabilitar combinaciones de filtros que permitan identificacion indirecta.
- Permitir vista detallada solo en reportes internos autorizados.

La decision final dependera de lineamientos internos, nivel de sensibilidad permitido y criterios de la institucion.

### 6. Preparacion para otros programas de salud

Aunque el piloto sea ITS, la arquitectura debe evitar quedar limitada artificialmente a ITS.

Se debe procurar que estas piezas sean reutilizables:

- Flujo de aprobacion.
- Estructura territorial.
- Usuarios y permisos.
- Exportacion por plantillas.
- Reportes agregados.
- Auditoria.
- Mapas.
- Semanas epidemiologicas.

No se implementaran otros programas de salud de entrada, pero el diseno no debe impedir incorporarlos en el futuro.

### 7. Pruebas desde etapas tempranas

El proyecto debe incluir pruebas para las reglas mas sensibles.

Prioridades:

- Validacion de permisos por rol y alcance.
- Reglas de privacidad ITS 1 vs ITS 2.
- Consolidacion ITS 1 a ITS 2.
- Flujo de estados y devoluciones.
- Validaciones por sexo y embarazo.
- Calculo de semana epidemiologica.
- Versionamiento de reportes.
- Auditoria de cambios.
- Exportaciones basadas en plantilla.

Las pruebas deben enfocarse primero en reglas de negocio, no solo en componentes visuales.

## Mejoras operativas aprobadas antes de desarrollo

Se aprueban como parte del diseno las siguientes mejoras:

- Definir politica de privacidad geografica configurable antes de produccion.
- Crear modulo de importacion con staging para historicos, atenciones por edad y geografia.
- Incorporar Redis + BullMQ para trabajos asincronos.
- Mantener Leaflet para piloto, con modelo preparado para MapLibre/vector tiles.
- Versionar reportes enviados y coberturas/territorios.
- Crear pruebas automatizadas para reglas criticas.
- Mantener separacion estricta entre ITS 1 individual e ITS 2 agregado.

La matriz de permisos queda como documento pendiente de formalizacion si no existe una version cerrada antes del desarrollo.
