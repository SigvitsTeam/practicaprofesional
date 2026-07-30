# Evaluacion critica de tecnologias y arquitectura

## Objetivo

Evaluar de forma critica las tecnologias seleccionadas y las oportunidades de mejora para que el sistema ITS pueda iniciar como piloto, pero escalar a una operacion institucional municipal, regional, central y nacional.

## Conclusion ejecutiva

El stack propuesto sigue siendo adecuado:

```text
Angular -> NestJS -> PostgreSQL/Supabase
```

Pero para gran escala no debe verse como tres piezas aisladas. Debe convertirse en una arquitectura institucional completa:

```text
Angular
NestJS modular
PostgreSQL/PostGIS
Motor de permisos
Colas de trabajo
Almacenamiento de archivos
Auditoria
Observabilidad
Backups
Exportaciones asincronas
Importaciones validadas
```

La recomendacion principal es mantener Angular y NestJS, pero tomar una decision consciente sobre Supabase:

- Supabase es excelente para piloto y despliegue rapido.
- Para escala institucional, la base real debe pensarse como PostgreSQL portable.
- El sistema no debe depender de caracteristicas de Supabase de forma irreversible.

## Evaluacion del stack actual

### Angular

Angular es adecuado para este proyecto por:

- Formularios complejos.
- Rutas protegidas.
- Modulos administrativos.
- Validaciones en interfaz.
- Pantallas densas de gestion.
- Escalabilidad de codigo y equipo.

Riesgos:

- Puede volverse pesado si no se modulariza.
- Los componentes pueden absorber logica de negocio si no hay disciplina.
- Requiere estructura clara desde el inicio.

Decision recomendada:

```text
Mantener Angular.
```

Lineamientos:

- Usar modulos o features por dominio.
- Mantener guards por permisos.
- Separar componentes visuales de servicios API.
- No poner reglas institucionales criticas en Angular.
- Usar formularios reactivos.
- Crear validadores reutilizables solo para experiencia de usuario; el backend siempre valida de nuevo.

### NestJS

NestJS es adecuado por:

- TypeScript en backend.
- Arquitectura modular.
- Buen encaje con Clean Code y SOLID.
- Controladores, servicios, guards, pipes e interceptors.
- Facilidad para separar permisos, auditoria, reportes y consolidaciones.

Riesgos:

- Si se usa mal, puede terminar en servicios gigantes.
- Si toda la logica queda en controladores, se pierde mantenibilidad.
- Puede mezclarse logica de acceso a datos con reglas de negocio.

Decision recomendada:

```text
Mantener NestJS como autoridad de reglas de negocio.
```

Lineamientos:

- Controladores delgados.
- Servicios por caso de uso.
- Repositorios o capa de acceso a datos.
- Guards para permisos.
- Pipes/DTOs para validacion de entrada.
- Interceptors para auditoria, trazabilidad y logging.

### Supabase PostgreSQL

Supabase aporta:

- PostgreSQL administrado.
- Auth.
- Storage.
- RLS.
- Backups segun plan.
- Dashboard de administracion.
- Rapidez para piloto.

Riesgos:

- Dependencia de proveedor si se usan demasiadas caracteristicas especificas.
- Costos y limites pueden cambiar al escalar.
- Las reglas pueden dispersarse entre RLS, backend y frontend.
- Si Angular accede directo a tablas, se rompe la separacion institucional.
- El uso del service role en backend puede saltarse RLS si no se controla cuidadosamente.

Decision recomendada:

```text
Usar Supabase como PostgreSQL administrado en piloto, pero disenar el sistema como portable a PostgreSQL estandar.
```

Lineamientos:

- Angular no debe operar directamente sobre tablas criticas.
- NestJS debe ser la puerta de entrada para procesos sensibles.
- Usar RLS como defensa en profundidad, no como reemplazo del backend.
- Mantener tablas sensibles en esquemas no expuestos si es posible.
- Evitar acoplar reglas de negocio a funciones propietarias innecesarias.
- Mantener migraciones versionadas fuera del dashboard.

### PostgreSQL y PostGIS

PostgreSQL debe ser la base principal por:

- Modelo relacional fuerte.
- Integridad referencial.
- Vistas y materialized views.
- Agregaciones robustas.
- JSONB para auditoria o metadatos.
- PostGIS para geografia.

PostGIS debe considerarse parte central del diseno geografico:

- Establecimientos.
- Comunidades.
- Poligonos o centroides.
- Procedencia.
- Cobertura.
- Analisis espacial futuro.

Decision recomendada:

```text
Usar PostgreSQL + PostGIS como nucleo de datos.
```

## Tecnologias que se deben agregar o evaluar

### ORM y migraciones

Opciones:

- Prisma.
- Drizzle.
- TypeORM.
- SQL directo con migraciones.

Recomendacion:

```text
Evaluar Prisma como primera opcion, complementado con SQL crudo para consultas complejas, vistas, funciones y PostGIS.
```

Razones:

- Buen soporte TypeScript.
- Migraciones claras.
- Cliente tipado.
- Buena productividad.

Advertencia:

PostGIS, consultas analiticas, reportes y consolidaciones complejas pueden requerir SQL directo. No todo debe forzarse dentro del ORM.

### Cola de trabajos

Esta es una brecha importante.

El sistema necesitara procesos que no deben ejecutarse dentro de una peticion HTTP normal:

- Importacion de Excel historico.
- Validacion de cargas.
- Generacion de Excel.
- Conversion a PDF.
- Consolidaciones pesadas.
- Envio de notificaciones.
- Recalculo de indicadores.

Recomendacion:

```text
Agregar BullMQ + Redis.
```

Uso:

- Jobs de exportacion.
- Jobs de importacion.
- Jobs de recalculo.
- Jobs de validacion.
- Jobs de cierre de periodo.

Sin cola, el backend puede volverse lento o inestable cuando varios usuarios generen reportes.

### Almacenamiento de archivos

Se necesita almacenar:

- Plantillas oficiales.
- Reportes generados.
- Archivos Excel importados.
- Evidencia de cargas historicas.
- Logs o comprobantes de exportacion.

Opciones:

- Supabase Storage.
- S3 compatible.
- MinIO self-hosted.

Recomendacion:

```text
Usar una abstraccion de almacenamiento.
```

Para piloto:

```text
Supabase Storage.
```

Para escala institucional o self-hosting:

```text
S3 compatible o MinIO.
```

La aplicacion no debe depender directamente de un proveedor de storage.

### Autenticacion y gestion institucional de identidad

Opciones:

- Supabase Auth.
- Auth propia en NestJS.
- Keycloak.
- Proveedor institucional futuro.

Recomendacion:

```text
Supabase Auth puede servir para piloto, pero disenar una capa de Auth desacoplada.
```

Para escala institucional, evaluar:

```text
Keycloak
```

Razones:

- Open source.
- Control institucional.
- Roles y grupos.
- Integracion futura con SSO.
- Mayor independencia de proveedor.

No es obligatorio para la primera version, pero no se debe cerrar la puerta.

### Mapas

Stack actual:

```text
Leaflet + PostGIS
```

Es adecuado para:

- Puntos de establecimientos.
- Puntos o poligonos simples de comunidades.
- Mapas de captacion.
- Mapas de procedencia.

Riesgo:

Si se cargan muchos poligonos, capas, filtros y visualizaciones nacionales, Leaflet puede quedarse corto.

Alternativa a evaluar:

```text
MapLibre GL
```

Recomendacion:

```text
Usar Leaflet para piloto y primera version.
Disenar datos geograficos de forma compatible con MapLibre/vector tiles si el sistema escala.
```

### Mapas por jerarquia institucional

La vision del proyecto requiere mapas por alcance:

```text
Establecimiento -> area propia.
Municipio -> mapa municipal.
Region -> mapa departamental/regional.
Nivel Central -> mapa nacional.
```

Esto aumenta la importancia de PostGIS y de una API geoespacial bien disenada.

Recomendacion tecnica:

```text
PostGIS debe ser la fuente de verdad geografica.
```

Los limites, centroides, establecimientos y areas de cobertura no deben vivir como archivos sueltos en Angular. Deben estar gestionados como datos:

- Catalogo unico de territorios geograficos con pais, departamentos y municipios.
- Asociacion de regiones sanitarias con uno o mas territorios.
- Asociacion de cada coordinacion municipal con una silueta precargada.
- Tabla de comunidades con punto o poligono.
- Tabla de establecimientos con punto.
- Tabla de coberturas con relaciones y, si existe, geometria.

Para el piloto, la cobertura real del establecimiento puede determinarse inicialmente desde la declaracion del usuario en ITS 1:

```text
¿Pertenece al AGI del establecimiento? Si/No
```

Esto reduce la dependencia inicial de contar con un catalogo completo de comunidades asignadas a cada establecimiento.

Implicacion:

- PostGIS sigue siendo importante para mapas y expansion.
- El catalogo comunitario deja de ser bloqueante para iniciar captura.
- La normalizacion de barrios/colonias puede implementarse progresivamente.
- El mapa de cobertura real puede calcularse por el indicador AGI mientras se construye una base geografica mas precisa.

Los mapas no deben consultar ITS 1 individual en niveles superiores. Deben consultar endpoints agregados por alcance.

Ejemplos:

```text
GET /maps/municipal/:municipioId/establishments-summary
GET /maps/regional/:regionId/municipalities-summary
GET /maps/national/regions-summary
```

Cada endpoint debe aceptar filtros:

- Periodo.
- Semana epidemiologica.
- Anio.
- Sexo.
- Grupo de edad.
- Enfermedad.
- Clasificacion.
- Tipo de caso.
- Tipo de poblacion.
- Procedencia.

#### Leaflet vs MapLibre

Leaflet:

- Excelente para piloto.
- Simple.
- Facil de integrar.
- Adecuado para puntos, marcadores y GeoJSON moderado.
- Menor complejidad tecnica.

MapLibre GL:

- Mejor para muchos poligonos.
- Mejor para mapas nacionales con varias capas.
- Mejor para estilos vectoriales.
- Mejor si se usan vector tiles.
- Requiere mas preparacion tecnica.

Decision recomendada:

```text
Iniciar con Leaflet si el piloto se limita a Puerto Cortes/Cortes.
Disenar el modelo geografico y API para poder migrar a MapLibre si escala a nivel nacional.
```

Si desde el inicio se confirma alcance nacional con muchas capas y poligonos, evaluar MapLibre antes de implementar el modulo de mapas.

#### Generacion automatica de mapas

El sistema no debe generar archivos de mapa estaticos ni pedir al usuario que
dibuje cada municipio. Debe renderizar dinamicamente una coleccion de siluetas
precargadas y combinarla con datos operativos agregados.

Flujo:

```text
Crear establecimiento -> registrar latitud/longitud -> aparece automaticamente como marcador en mapas de su alcance.
Crear municipio -> asociar codigo oficial -> previsualizar silueta precargada -> validar y activar.
Crear region -> asociar departamento(s) del catalogo -> aparece en mapa nacional.
```

Para que esto funcione, se necesita una pantalla administrativa de geografia:

- Catalogo precargado con codigo, nombre, jerarquia, geometria, centroide y zoom recomendado.
- Asociacion automatica por codigo oficial.
- Previsualizacion y validacion visual.
- Carga o reemplazo excepcional de GeoJSON/Shapefile por SuperAdmin.
- Gestion de coordenadas de establecimientos.
- Asignacion de cobertura.
- Activar/desactivar objeto geografico.

#### Activacion progresiva de territorios

La arquitectura debe distinguir entre:

```text
Base geografica de referencia
Territorios operativos del sistema
```

Ejemplo:

```text
Nivel Central puede ver Honduras completo como mapa base.
Pero solo las regiones creadas/activas participan en KPIs operativos.
```

Flujo operativo esperado:

```text
SuperAdmin/Nivel Central inicial
-> crea Region Sanitaria Departamental de Cortes
-> se activa mapa operativo de Cortes
-> Region Cortes crea Coordinacion Municipal de Puerto Cortes
-> se activa mapa operativo de Puerto Cortes
-> Coordinacion Puerto Cortes crea 12 establecimientos
-> establecimientos aparecen como marcadores y quedan listos para capturar informacion
```

Implicaciones tecnicas:

- Cargar una base geografica nacional inicial, al menos departamentos.
- Manejar estados de territorios: preconfigurado, creado, activo, inactivo, en pilotaje.
- Separar endpoints de mapa base y mapa operativo.
- Los KPIs deben calcularse solo sobre territorios activos.
- Los usuarios solo deben operar sobre territorios asignados.

Endpoints sugeridos:

```text
GET /maps/base/national
GET /maps/operational/national
GET /maps/operational/regions/:regionId
GET /maps/operational/municipalities/:municipioId
```

Esto permite mostrar Honduras completo a nivel central sin fingir que todo el pais ya esta implementado.

#### KPIs geograficos dinamicos

Los marcadores y poligonos deben actualizar datos segun filtros.

Ejemplo:

```text
Filtro: Sexo = Hombre
Alcance: Municipio Puerto Cortes
Resultado: cada establecimiento muestra cantidad de hombres con ITS captados.
```

Para rendimiento, evaluar:

- Consultas agregadas optimizadas.
- Indices por periodo, establecimiento, municipio, region, sexo, edad y enfermedad.
- Materialized views para reportes cerrados.
- Cache de resultados frecuentes.
- Jobs de recalculo al cerrar reportes.

### Graficas y dashboards

Opciones:

- ECharts.
- Chart.js.
- Metabase/Superset como BI complementario.

Recomendacion:

```text
Usar ECharts para dashboards dentro de la app.
```

Motivos:

- Mejor para visualizaciones complejas.
- Soporta mas tipos de graficos.
- Mejor para interactividad avanzada.

Chart.js es mas simple, pero ECharts encaja mejor con analisis institucional.

Evaluar despues:

```text
Metabase o Apache Superset
```

Solo como herramienta interna de analisis, no como reemplazo de los reportes oficiales.

### Exportacion Excel y PDF

Stack actual:

```text
ExcelJS + LibreOffice headless
```

Es razonable, pero hay riesgos.

Riesgos:

- Conversion Excel a PDF puede variar segun entorno.
- LibreOffice debe correr en servidor o contenedor controlado.
- Reportes complejos pueden tardar.
- Si se ejecuta en HTTP directo, puede bloquear peticiones.

Recomendacion:

```text
ExcelJS para llenar plantillas.
LibreOffice headless en worker/cola para PDF.
Guardar resultado y version.
```

Punto critico:

La generacion de reportes debe ser asincrona.

### Importacion de Excel

Este proyecto no solo exporta; tambien importa:

- Historicos 2026.
- Total de atenciones por rangos de edad.
- Posibles cargas municipales/regionales.
- Plantillas oficiales futuras.

Recomendacion:

```text
Crear un modulo de importacion con staging tables.
```

Flujo:

```text
Subir archivo -> detectar plantilla -> leer datos -> validar -> mostrar errores -> confirmar -> publicar datos
```

No insertar directamente datos importados en tablas oficiales sin validacion.

### Observabilidad

Brecha actual.

Se necesita:

- Logs estructurados.
- Trazabilidad de errores.
- Monitoreo de jobs.
- Registro de tiempos de generacion de reportes.
- Alertas si fallan imports/exports.

Tecnologias a evaluar:

- Sentry para errores.
- OpenTelemetry para trazas.
- Grafana/Prometheus si se self-hospeda.
- Logs JSON desde NestJS.

Recomendacion:

```text
Agregar observabilidad desde temprano, aunque sea minima.
```

### Backups y recuperacion

Brecha critica para escala institucional.

Debe definirse:

- Backup automatico de base de datos.
- Prueba de restauracion.
- Retencion.
- Backup de archivos generados/importados.
- Plan de recuperacion ante error humano.

Recomendacion:

```text
No considerar produccion real sin estrategia de backup y restauracion probada.
```

### Seguridad

El proyecto maneja ITS, por tanto es sensible.

Recomendaciones:

- HTTPS obligatorio.
- Hashing seguro si se maneja auth propia.
- MFA para SuperAdmin y roles superiores, si es posible.
- Auditoria inmutable o dificil de alterar.
- Minimo privilegio.
- RLS como defensa en profundidad.
- Separar datos individuales de agregados tambien a nivel de API.
- No exponer endpoints genericos de ITS 1 a niveles superiores.
- Cifrado en reposo segun proveedor disponible.
- Politica de retencion de datos.

## Recomendacion arquitectonica refinada

### Arquitectura recomendada

```text
Angular
  -> NestJS API
      -> PostgreSQL/PostGIS
      -> Redis/BullMQ
      -> Storage
      -> Export worker
      -> Import worker
      -> Audit log
```

### Patron de backend

Recomendacion:

```text
Modular monolith con arquitectura limpia.
```

No recomiendo microservicios al inicio.

Razones:

- Aumentan complejidad operativa.
- Requieren DevOps mas maduro.
- El dominio aun esta tomando forma.
- Un monolito modular bien hecho puede escalar mucho.

Estructura conceptual:

```text
Controller -> Use Case/Application Service -> Domain Service -> Repository -> Database
```

## Tecnologias recomendadas por categoria

### Mantener

- Angular.
- NestJS.
- PostgreSQL.
- PostGIS.
- Leaflet para primera etapa.
- ECharts.
- ExcelJS.

### Agregar

- Redis.
- BullMQ.
- Prisma o migraciones SQL controladas.
- Storage abstraction.
- Sentry u observabilidad equivalente.
- Docker.
- CI/CD.
- Staging tables para importaciones.

### Evaluar antes de produccion nacional

- Keycloak para identidad institucional.
- MapLibre GL para mapas de mayor escala.
- MinIO/S3 para almacenamiento portable.
- Metabase o Superset para analisis interno.
- PostgreSQL administrado fuera de Supabase si la institucion requiere control total.

## Riesgos principales

### Riesgo 1: Sobreusar Supabase como backend

Mitigacion:

```text
NestJS debe seguir siendo autoridad de negocio.
```

### Riesgo 2: Reportes lentos o bloqueantes

Mitigacion:

```text
Generacion asincrona con BullMQ/Redis.
```

### Riesgo 3: Importaciones historicas con errores

Mitigacion:

```text
Staging, validacion previa y confirmacion antes de publicar.
```

### Riesgo 4: Permisos ambiguos

Mitigacion:

```text
Matriz formal de permisos y pruebas automatizadas.
```

### Riesgo 5: Privacidad en mapas

Mitigacion:

```text
Politica institucional de supresion/agrupacion pendiente de definir.
```

### Riesgo 6: El proyecto crece demasiado

Mitigacion:

```text
Vision completa, construccion incremental.
```

## Decision recomendada

La mejor ruta no es cambiar radicalmente de stack. La mejor ruta es fortalecerlo.

Stack refinado:

```text
Angular
NestJS
PostgreSQL/PostGIS
Supabase como proveedor inicial de PostgreSQL/Auth/Storage
Redis + BullMQ
ExcelJS
LibreOffice headless en worker
ECharts
Leaflet, con posible evolucion a MapLibre
Docker
CI/CD
Observabilidad
```

Principio final:

> Usar tecnologias conocidas y productivas, pero con capas de abstraccion que permitan escalar, migrar o endurecer el sistema sin rehacerlo.
