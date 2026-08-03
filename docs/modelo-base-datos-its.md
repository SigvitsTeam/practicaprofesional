# Modelo de Base de Datos del Sistema ITS

## Objetivo

Definir un modelo de base de datos preparado para:

- Captura de ITS 1 en establecimientos.
- Generacion de ITS 2 por niveles.
- Flujo establecimiento -> municipio -> region -> central -> nacional.
- Privacidad por diseno.
- Mapas por alcance territorial.
- Procedencia textual manual.
- Reportes mensuales, semanales, trimestrales, semestrales y anuales.
- Evaluacion anual general y comparativa.
- Historicos y linea base.
- Exportaciones oficiales.
- Auditoria.
- Escalabilidad a nuevos municipios, regiones y otros programas de salud.

Base recomendada:

```text
PostgreSQL + PostGIS
```

Proveedor inicial:

```text
Supabase PostgreSQL
```

## Principios del modelo

1. ITS 1 es dato individual y sensible.
2. ITS 1 solo pertenece al establecimiento.
3. ITS 2 es dato consolidado/agregado.
4. Municipio, region y nivel central no consultan ITS 1 individual.
5. Los reportes enviados se congelan por version.
6. Todo cambio relevante se audita.
7. Los territorios son administrables, no quemados en codigo.
8. La interfaz utiliza un mapa unico que combina geografia base y capas operativas.
9. El sistema debe soportar datos historicos/importados.
10. El modelo debe poder crecer a otros programas sin redisenar todo.

## Esquemas sugeridos

Para ordenar permisos y sensibilidad, se recomienda separar logicamente:

```text
auth_app       usuarios, roles, permisos.
territorial    paises, regiones, municipios, establecimientos, geografia.
its            atenciones ITS 1 y diagnosticos.
reports        reportes, consolidados, versiones y flujo.
imports        importaciones, staging y validaciones.
exports        plantillas y archivos generados.
audit          auditoria.
catalogs       catalogos generales.
```

En una primera version puede usarse `public`, pero el diseno debe mantener esta separacion conceptual.

## Usuarios, roles y permisos

### roles

```sql
roles
- id uuid pk
- codigo text unique
- nombre text
- descripcion text
- nivel_jerarquico int
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

Roles iniciales:

```text
SUPERADMIN
NIVEL_CENTRAL
ADMIN_REGIONAL
COORDINADOR_MUNICIPAL
DIGITADOR_COORDINACION
RESPONSABLE_ESTABLECIMIENTO
DIGITADOR_ESTABLECIMIENTO
SUPERVISOR_CONSULTA
```

### permisos

```sql
permisos
- id uuid pk
- codigo text unique
- modulo text
- accion text
- descripcion text
- activo boolean
```

### rol_permiso

```sql
rol_permiso
- rol_id uuid fk roles
- permiso_id uuid fk permisos
- primary key (rol_id, permiso_id)
```

### usuarios

```sql
usuarios
- id uuid pk
- auth_user_id uuid unique null
- nombre_completo text
- email text unique
- telefono text null
- rol_id uuid fk roles
- pais_id uuid null
- region_id uuid null
- municipio_id uuid null
- establecimiento_id uuid null
- activo boolean
- ultimo_acceso_at timestamptz null
- created_at timestamptz
- updated_at timestamptz
```

Regla:

```text
El alcance territorial del usuario se interpreta por rol + region_id + municipio_id + establecimiento_id.
```

Para `DIGITADOR_COORDINACION`, `municipio_id` identifica la coordinacion a la que pertenece, pero no concede acceso automatico a todos los datos individuales. Los establecimientos operables deben resolverse desde `usuario_asignaciones`, y cada solicitud sobre ITS 1 debe incluir y validar el establecimiento activo.

### usuario_asignaciones

Para permitir multiples asignaciones futuras:

```sql
usuario_asignaciones
- id uuid pk
- usuario_id uuid fk usuarios
- pais_id uuid null
- region_id uuid null
- municipio_id uuid null
- establecimiento_id uuid null
- fecha_inicio date
- fecha_fin date null
- activo boolean
- created_at timestamptz
```

Reglas para el digitador de coordinacion:

```text
- Una asignacion activa por cada establecimiento que puede operar (12 en el piloto).
- El establecimiento de cada registro ITS 1 se toma del contexto seleccionado y validado por backend, nunca solo de un valor enviado por la interfaz.
- Captura y correccion requieren asignacion activa y periodo/reporte editable o devuelto.
- Generacion y envio de ITS 2 requieren la misma asignacion activa.
- Revision, aprobacion y cierre requieren otro permiso y no se conceden a este rol.
- La auditoria registra usuario, establecimiento activo, accion, reporte/version, motivo y fecha.
```

## Territorio y geografia

### territorios_geograficos

Catalogo geografico precargado e independiente de la estructura sanitaria operativa.
Contiene una sola copia de cada silueta y permite construir las vistas municipal,
departamental y nacional sin mapas duplicados.

```sql
territorios_geograficos
- id uuid pk
- territorio_padre_id uuid null fk territorios_geograficos
- tipo text -- PAIS, DEPARTAMENTO, MUNICIPIO
- codigo_oficial text
- nombre text
- geom geometry(MultiPolygon, 4326) not null
- centroide geometry(Point, 4326) not null
- zoom_recomendado numeric null
- fuente text
- version_fuente text null
- fecha_fuente date null
- estado_validacion text -- IMPORTADO, VALIDADO, REEMPLAZADO, OBSERVADO
- validado_por uuid null fk usuarios
- validado_at timestamptz null
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

Restricciones:

```text
unique(tipo, codigo_oficial)
La geometria oficial se carga por importacion; no se dibuja manualmente.
Toda geometria se normaliza a EPSG:4326.
Un municipio tiene como padre un departamento y un departamento tiene como padre Honduras.
```

### regiones

```sql
regiones
- id uuid pk
- nombre text
- codigo text null
- numero_region text null
- tipo text -- sanitaria, departamental, metropolitana
- estado_operativo text -- PRECONFIGURADO, CREADO, EN_PILOTAJE, ACTIVO, INACTIVO, SUSPENDIDO
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

La region es una entidad sanitaria. Su alcance geografico se asigna mediante
`region_territorios`, incluso cuando inicialmente coincida con un departamento.

### region_territorios

```sql
region_territorios
- region_id uuid fk regiones
- territorio_geografico_id uuid fk territorios_geograficos
- fecha_inicio date
- fecha_fin date null
- activo boolean
```

### municipios

```sql
municipios
- id uuid pk
- region_id uuid fk regiones
- territorio_geografico_id uuid unique fk territorios_geograficos
- nombre text
- codigo text null
- estado_operativo text
- zoom_personalizado numeric null
- mostrar_etiqueta boolean default true
- mapa_validado boolean default false
- mapa_validado_por uuid null fk usuarios
- mapa_validado_at timestamptz null
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

Nota: en el piloto, Puerto Cortes se maneja como coordinacion municipal de salud dentro de la region de Cortes.

Al crear o configurar un municipio, el sistema busca `territorio_geografico_id`
por su codigo oficial, muestra la silueta precargada y solicita validacion visual.
El usuario no introduce los vertices del poligono.

### establecimientos_salud

```sql
establecimientos_salud
- id uuid pk
- municipio_id uuid fk municipios
- nombre text
- codigo text null
- tipo text -- CIS, UAPS, etc.
- direccion text null
- latitud numeric null
- longitud numeric null
- geom geometry(Point, 4326) null
- estado_operativo text
- coordenadas_validadas boolean default false
- coordenadas_validadas_por uuid fk usuarios null
- coordenadas_validadas_at timestamptz null
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

Regla:

```text
La coordinacion correspondiente valida visualmente las coordenadas de sus establecimientos.
```

### comunidades

Opcional para piloto, util para expansion.

```sql
comunidades
- id uuid pk
- municipio_id uuid fk municipios
- nombre_oficial text
- tipo text -- barrio, colonia, aldea, caserio, comunidad
- geom geometry(MultiPolygon, 4326) null
- centroide geometry(Point, 4326) null
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

### comunidad_alias

```sql
comunidad_alias
- id uuid pk
- comunidad_id uuid fk comunidades
- alias text
- activo boolean
```

### establecimiento_coberturas

Para versionar coberturas cuando exista catalogo comunitario.

```sql
establecimiento_coberturas
- id uuid pk
- establecimiento_id uuid fk establecimientos_salud
- comunidad_id uuid fk comunidades
- fecha_inicio date
- fecha_fin date null
- activo boolean
- created_at timestamptz
```

### territorio_historial

```sql
territorio_historial
- id uuid pk
- entidad_tipo text -- region, municipio, establecimiento, comunidad
- entidad_id uuid
- accion text
- datos_anteriores jsonb
- datos_nuevos jsonb
- usuario_id uuid fk usuarios
- motivo text null
- created_at timestamptz
```

## Catalogos ITS

### programas_salud

Aunque el piloto sea ITS, esto permite escalar.

```sql
programas_salud
- id uuid pk
- codigo text unique
- nombre text
- descripcion text null
- activo boolean
```

### clasificaciones_its

```sql
clasificaciones_its
- id uuid pk
- programa_id uuid fk programas_salud
- codigo text
- nombre text -- Sindromico, Clinico, C/E, Etiologico
- orden int
- activo boolean
```

### enfermedades_its

```sql
enfermedades_its
- id uuid pk
- clasificacion_id uuid fk clasificaciones_its
- codigo text null
- nombre text
- aplica_hombre boolean
- aplica_mujer boolean
- requiere_alerta_edad boolean default false
- orden_formato int
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

### grupos_edad

```sql
grupos_edad
- id uuid pk
- codigo text
- nombre text
- edad_min int null
- edad_max int null
- orden_formato int
- activo boolean
```

### grupos_edad_comparativo

Para tasas del comparativo anual.

```sql
grupos_edad_comparativo
- id uuid pk
- codigo text unique -- MENOR_15, MAYOR_IGUAL_15
- nombre text
- edad_min int null
- edad_max int null
- definicion text
- activo boolean
```

### tipos_poblacion

```sql
tipos_poblacion
- id uuid pk
- codigo text unique
- nombre text -- General, Trabajador(a) sexual
- activo boolean
```

### semanas_epidemiologicas

```sql
semanas_epidemiologicas
- id uuid pk
- anio int
- numero_semana int
- fecha_inicio date
- fecha_fin date
- activa boolean
- unique (anio, numero_semana)
```

## Periodos

### periodos

```sql
periodos
- id uuid pk
- tipo text -- mensual, semanal, trimestral, semestral, anual
- anio int
- mes int null
- trimestre int null
- semestre int null
- semana_epidemiologica_id uuid null fk semanas_epidemiologicas
- fecha_inicio date
- fecha_fin date
- estado text -- abierto, cerrado, bloqueado
- created_at timestamptz
- updated_at timestamptz
```

Los reportes se relacionan con periodos, pero la fecha de atencion es la fuente para calcular semana, mes, trimestre, semestre y anio.

## Captura ITS 1

### atenciones_its

Dato individual. Acceso restringido a establecimiento.

```sql
atenciones_its
- id uuid pk
- programa_id uuid fk programas_salud
- fecha_atencion date
- semana_epidemiologica_id uuid fk semanas_epidemiologicas
- periodo_mensual_id uuid fk periodos
- anio int
- mes int
- region_id uuid fk regiones
- municipio_id uuid fk municipios
- establecimiento_atencion_id uuid fk establecimientos_salud
- usuario_registro_id uuid fk usuarios
- numero_expediente text
- procedencia_texto text
- sexo text -- H, M
- edad int
- grupo_edad_id uuid fk grupos_edad
- grupo_edad_comparativo_id uuid fk grupos_edad_comparativo
- tipo_poblacion_id uuid fk tipos_poblacion
- es_contacto boolean
- esta_embarazada boolean
- estado text -- activo, anulado
- posible_duplicado boolean default false
- observacion text null
- created_at timestamptz
- updated_at timestamptz
```

Restricciones recomendadas:

```text
sexo in ('H', 'M')
edad >= 0
si sexo = H, esta_embarazada debe ser false
procedencia_texto no debe estar vacio y debe conservar el valor digitado por el usuario
```

`procedencia_texto` es un campo abierto y obligatorio para comunidad o direccion. La captura no utiliza clasificaciones territoriales ni relaciones obligatorias con catalogos. Si posteriormente se normaliza el texto para analisis, el resultado derivado debe almacenarse por separado sin reemplazar el valor original.

### diagnosticos_atencion

```sql
diagnosticos_atencion
- id uuid pk
- atencion_id uuid fk atenciones_its
- enfermedad_id uuid fk enfermedades_its
- tipo_caso text -- NUEVO, CONTROL
- created_at timestamptz
- updated_at timestamptz
```

Regla:

```text
Una atencion puede tener uno o varios diagnosticos.
```

Validaciones:

- Enfermedad debe aplicar al sexo.
- Tipo de caso obligatorio.
- No duplicar misma enfermedad y tipo de caso en la misma atencion salvo regla institucional.

## Total de atenciones para tasas

### atenciones_produccion

Denominadores para tasas y comparativos.

```sql
atenciones_produccion
- id uuid pk
- periodo_id uuid fk periodos
- anio int
- mes int null
- nivel text -- establecimiento, municipal, regional, nacional
- region_id uuid null fk regiones
- municipio_id uuid null fk municipios
- establecimiento_id uuid null fk establecimientos_salud
- grupo_edad_comparativo_id uuid fk grupos_edad_comparativo
- total_atenciones int
- fuente text -- digitado, excel, sistema_externo, historico
- es_historico boolean default false
- estado_carga text -- SIN_CARGA, PARCIAL, COMPLETO, VALIDADO, OBSERVADO
- archivo_importacion_id uuid null
- observaciones text null
- creado_por uuid fk usuarios
- validado_por uuid null fk usuarios
- created_at timestamptz
- updated_at timestamptz
```

Regla:

```text
Si falta total_atenciones o es cero, la tasa queda pendiente/no calculable.
```

## Reportes y consolidados ITS 2

### reportes_its

Representa reporte mensual/anual/semanal por nivel.

```sql
reportes_its
- id uuid pk
- programa_id uuid fk programas_salud
- periodo_id uuid fk periodos
- tipo_reporte text -- ITS2_MENSUAL, EVALUACION_ANUAL, COMPARATIVO_ANUAL
- nivel text -- establecimiento, municipal, regional, nacional
- region_id uuid null fk regiones
- municipio_id uuid null fk municipios
- establecimiento_id uuid null fk establecimientos_salud
- estado text
- version int
- es_version_actual boolean
- generado_por uuid fk usuarios
- enviado_por uuid null fk usuarios
- aprobado_por uuid null fk usuarios
- cerrado_por uuid null fk usuarios
- fecha_generacion timestamptz
- fecha_envio timestamptz null
- fecha_aprobacion timestamptz null
- fecha_cierre timestamptz null
- comentario_actual text null
- created_at timestamptz
- updated_at timestamptz
```

Estados:

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

### reporte_its_detalle

Foto congelada del consolidado enviado/aprobado.

```sql
reporte_its_detalle
- id uuid pk
- reporte_id uuid fk reportes_its
- enfermedad_id uuid fk enfermedades_its
- grupo_edad_id uuid null fk grupos_edad
- grupo_edad_comparativo_id uuid null fk grupos_edad_comparativo
- sexo text null
- tipo_poblacion_id uuid null fk tipos_poblacion
- tipo_caso text null
- es_contacto boolean null
- esta_embarazada boolean null
- total int
```

### reporte_flujo_historial

```sql
reporte_flujo_historial
- id uuid pk
- reporte_id uuid fk reportes_its
- estado_anterior text null
- estado_nuevo text
- usuario_id uuid fk usuarios
- comentario text null
- created_at timestamptz
```

### observaciones_reporte

```sql
observaciones_reporte
- id uuid pk
- reporte_id uuid fk reportes_its
- usuario_id uuid fk usuarios
- nivel_origen text
- comentario text
- estado text -- abierta, resuelta, rechazada
- created_at timestamptz
- updated_at timestamptz
```

## Evaluacion anual y comparativo

Puede usar `reportes_its` y `reporte_its_detalle`, pero se recomienda detalle adicional para tasas.

### reporte_indicadores

```sql
reporte_indicadores
- id uuid pk
- reporte_id uuid fk reportes_its
- indicador_codigo text
- grupo_edad_comparativo_id uuid null
- anio_base int null
- anio_comparado int null
- numerador int null
- denominador int null
- valor numeric null
- estado_calculo text -- calculado, pendiente_denominador, no_aplica
- fuente_numerador text
- fuente_denominador text
```

Ejemplo:

```text
TASA_ITS_MENOR_15_X1000
TASA_ITS_MAYOR_IGUAL_15_X1000
```

## Importaciones y datos historicos

### importaciones

```sql
importaciones
- id uuid pk
- tipo text -- historico_its, atenciones_produccion, geografia, plantilla
- nombre_archivo text
- storage_path text
- estado text -- subido, validando, observado, validado, publicado, rechazado
- anio int null
- periodo_id uuid null fk periodos
- nivel text null
- region_id uuid null
- municipio_id uuid null
- establecimiento_id uuid null
- subido_por uuid fk usuarios
- publicado_por uuid null fk usuarios
- resumen jsonb null
- errores jsonb null
- created_at timestamptz
- updated_at timestamptz
```

### staging_historico_its

```sql
staging_historico_its
- id uuid pk
- importacion_id uuid fk importaciones
- fila_original int
- establecimiento_nombre text
- establecimiento_id uuid null
- anio int
- mes int null
- enfermedad_nombre text
- enfermedad_id uuid null
- sexo text null
- tipo_caso text null
- total int
- estado_validacion text
- errores jsonb null
```

### staging_atenciones_produccion

```sql
staging_atenciones_produccion
- id uuid pk
- importacion_id uuid fk importaciones
- fila_original int
- establecimiento_nombre text
- establecimiento_id uuid null
- anio int
- mes int null
- grupo_edad text
- grupo_edad_comparativo_id uuid null
- total_atenciones int
- estado_validacion text
- errores jsonb null
```

### staging_geografia

```sql
staging_geografia
- id uuid pk
- importacion_id uuid fk importaciones
- fila_original int
- tipo_entidad text
- nombre text
- codigo text null
- codigo_padre text null
- latitud numeric null
- longitud numeric null
- geojson jsonb null
- fuente text null
- version_fuente text null
- estado_validacion text
- errores jsonb null
```

Regla:

```text
Nada importado pasa a tablas oficiales sin validacion y confirmacion.
```

## Exportaciones y plantillas

### plantillas_reporte

```sql
plantillas_reporte
- id uuid pk
- codigo text
- nombre text
- tipo_reporte text
- version text
- storage_path text
- activo boolean
- created_at timestamptz
- updated_at timestamptz
```

### reportes_generados

```sql
reportes_generados
- id uuid pk
- reporte_id uuid fk reportes_its
- plantilla_id uuid fk plantillas_reporte
- formato text -- xlsx, pdf
- storage_path text
- estado text -- pendiente, generando, generado, error
- generado_por uuid fk usuarios
- job_id text null
- error_detalle text null
- created_at timestamptz
- updated_at timestamptz
```

## Auditoria

### auditoria_eventos

```sql
auditoria_eventos
- id uuid pk
- usuario_id uuid null fk usuarios
- accion text
- entidad text
- entidad_id uuid null
- nivel_dato text -- individual, agregado, configuracion
- datos_anteriores jsonb null
- datos_nuevos jsonb null
- motivo text null
- ip text null
- user_agent text null
- created_at timestamptz
```

### auditoria_consultas_sensibles

```sql
auditoria_consultas_sensibles
- id uuid pk
- usuario_id uuid fk usuarios
- tipo_consulta text -- mapa, exportacion, reporte_filtrado
- parametros jsonb
- alcance text
- created_at timestamptz
```

## Vistas y consultas agregadas

Para garantizar privacidad, los niveles superiores deben consumir vistas o endpoints agregados.

Vistas sugeridas:

```text
v_its2_establecimiento
v_its2_municipal
v_its2_regional
v_its2_nacional
v_mapa_establecimientos_resumen
v_mapa_municipios_resumen
v_mapa_regiones_resumen
v_indicadores_calidad_procedencia
```

Regla:

```text
Los endpoints municipales, regionales y centrales no deben devolver numero_expediente ni registros individuales.
```

## Indices recomendados

### ITS 1

```sql
idx_atenciones_establecimiento_periodo
idx_atenciones_fecha
idx_atenciones_semana
idx_atenciones_sexo
idx_diagnosticos_enfermedad
idx_diagnosticos_atencion
```

### Reportes

```sql
idx_reportes_periodo_nivel
idx_reportes_estado
idx_reportes_region
idx_reportes_municipio
idx_reportes_establecimiento
idx_reporte_detalle_reporte
```

### Geografia

```sql
gist_territorios_geograficos_geom
idx_territorios_tipo_codigo
idx_territorios_padre
idx_region_territorios_region
idx_municipios_territorio
gist_establecimientos_geom
gist_comunidades_geom
```

### Importaciones

```sql
idx_importaciones_tipo_estado
idx_importaciones_anio
idx_staging_importacion
```

## Reglas criticas a probar

- Usuario de establecimiento puede ver ITS 1 propio.
- Coordinador municipal y supervisor no pueden ver ITS 1 individual.
- Digitador de coordinacion solo puede ver y modificar ITS 1 del establecimiento activo cuando tiene una asignacion vigente y el reporte esta editable o devuelto.
- Cambiar el establecimiento activo debe volver a validar la asignacion y no puede mezclar registros entre establecimientos.
- Region no puede ver ITS 1.
- Central no puede ver ITS 1.
- SuperAdmin no debe acceder a ITS 1 salvo accion excepcional autorizada.
- ITS 2 se calcula desde ITS 1.
- Reporte enviado queda congelado por version.
- Devolucion permite correccion segun nivel.
- Procedencia es obligatoria y conserva el texto manual original.
- La captura no exige clasificacion territorial ni seleccion de comunidad desde catalogo.
- Tasas no se calculan sin denominador.
- Semanas epidemiologicas se calculan desde fecha_atencion.
- Enfermedad debe aplicar al sexo.
- Hombre no puede registrarse como embarazado.
- Importacion no publica datos sin validacion.
- Exportacion queda auditada.

## Observaciones de escalabilidad

Para piloto, varias tablas pueden iniciar con pocos datos. Para escala nacional:

- Usar materialized views o tablas de consolidados para reportes cerrados.
- Usar jobs asincronos para recalculos y exportaciones.
- Indexar filtros usados en mapas y dashboards.
- Separar lecturas agregadas de datos individuales.
- Mantener historiales para cambios territoriales y de cobertura.
- Mantener migraciones versionadas.

## Decision final

El modelo debe implementarse como un nucleo relacional fuerte con PostgreSQL/PostGIS, evitando que la logica critica dependa exclusivamente de la interfaz o de servicios externos.

La base debe permitir iniciar con Puerto Cortes, pero sin impedir crecimiento a:

- Mas municipios.
- Mas regiones.
- Nivel nacional.
- Otros programas de salud.
