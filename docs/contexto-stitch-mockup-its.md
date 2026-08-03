# Contexto para Stitch - Mockup del Sistema ITS

> **Actualización vigente del frontend (3 de agosto de 2026):** usar `docs/decisiones-frontend-2026-08-03.md` como fuente prioritaria. Se elimina AGI, se reemplaza el doble mapa por un mapa interactivo único y se incorpora el digitador de coordinación con selector de establecimiento.

## Objetivo del mockup

Crear un mockup de una plataforma web institucional para automatizar la captura, revision, consolidacion, exportacion y analisis de informes del programa ITS.

El sistema inicia como piloto en Puerto Cortes, Honduras, con 12 establecimientos de salud, pero debe sentirse preparado para escalar a region, nivel central y posteriormente nivel nacional.

La interfaz debe transmitir:

- Seriedad institucional.
- Claridad para usuarios de salud publica.
- Flujo ordenado de revision y aprobacion.
- Proteccion de datos sensibles.
- Capacidad analitica con mapas, KPIs, tablas y reportes.

No debe verse como una landing page comercial. Debe ser una aplicacion operativa tipo sistema institucional de salud.

## Nombre sugerido

Sistema de Gestion y Vigilancia ITS

Tambien puede mostrarse como:

SIGVITS

## Principio central del sistema

El dato individual nace y permanece en el establecimiento de salud.

Los niveles superiores no ven registros individuales. Solo revisan informacion consolidada y agregada.

Flujo institucional:

```text
Establecimiento -> Coordinacion Municipal -> Region -> Nivel Central -> Reporte Nacional
```

## Usuarios y roles principales

El mockup debe representar una aplicacion con acceso por rol:

- SuperAdmin: administra catalogos, territorios, usuarios, permisos y configuraciones.
- Nivel Central: revisa consolidados regionales, analiza mapa nacional y genera consolidado nacional.
- Admin Regional: revisa municipios de su region y genera consolidado regional.
- Coordinador Municipal: revisa reportes de establecimientos y genera consolidado municipal.
- Responsable de Establecimiento: captura ITS 1, genera ITS 2 y envia reporte mensual.
- Digitador de Establecimiento: registra atenciones ITS 1.
- Supervisor o Consulta: visualiza reportes segun permisos.

## Alcance del piloto

Pais:

- Honduras.

Region inicial:

- Region Sanitaria Departamental de Cortes.

Municipio piloto:

- Puerto Cortes.

Establecimientos:

- 12 establecimientos de salud de Puerto Cortes.

El mockup puede usar nombres de ejemplo como:

- CIS Cornelio Moncada Cordova.
- CIS Medina.
- UAPS Cieneguita.
- UAPS Baracoa.
- UAPS Rio Mar.
- UAPS Travesia.

## Modulos principales de la aplicacion

La navegacion lateral debe incluir:

- Inicio / Dashboard.
- Captura ITS 1.
- Reporte ITS 2.
- Bandeja de revision.
- Consolidados.
- Mapas.
- Evaluacion anual.
- Exportaciones.
- Importaciones.
- Catalogos.
- Territorio.
- Usuarios y permisos.
- Auditoria.

Para el mockup inicial, priorizar estas pantallas:

1. Dashboard institucional.
2. Captura ITS 1.
3. Generacion y envio de ITS 2.
4. Bandeja de revision municipal.
5. Mapa operativo de Puerto Cortes.
6. Reportes y exportaciones.
7. Administracion territorial.

## Pantalla 1: Dashboard institucional

Crear una pantalla principal con:

- Barra superior con nombre del sistema, usuario activo, rol y periodo seleccionado.
- Menu lateral con modulos.
- Filtros superiores: anio, mes, semana epidemiologica, region, municipio, establecimiento.
- Tarjetas KPI.
- Grafica de tendencia mensual.
- Tabla de estado de reportes.
- Panel de alertas.
- Acceso rapido a acciones principales.

KPIs sugeridos:

- Casos ITS del periodo.
- Casos nuevos.
- Controles.
- Reportes recibidos.
- Reportes pendientes.
- Reportes devueltos.
- Casos no AGI.
- Atenciones cargadas.
- Tasa ITS x 1000 atenciones.

Ejemplo de datos:

- Periodo: Julio 2026.
- Region: Cortes.
- Municipio: Puerto Cortes.
- Casos ITS: 184.
- Nuevos: 139.
- Controles: 45.
- Reportes recibidos: 9 de 12.
- Pendientes: 3.
- Casos no AGI: 27.
- Tasa ITS x 1000: 4.8.

## Pantalla 2: Captura ITS 1

Crear una pantalla de formulario para el establecimiento.

Debe verse como una pantalla de trabajo densa, clara y rapida de usar.

Secciones del formulario:

- Datos automaticos del establecimiento.
- Datos de la atencion.
- Procedencia y AGI.
- Datos del paciente.
- Diagnosticos.
- Validaciones y alertas.

Campos visibles:

- Fecha de atencion.
- Semana epidemiologica calculada.
- Numero de expediente o ID paciente.
- Procedencia declarada.
- Pertenece al AGI: Si / No.
- Clasificacion de procedencia externa.
- Municipio/departamento/pais de procedencia, segun aplique.
- Sexo: Hombre / Mujer.
- Edad.
- Tipo de poblacion: General / Trabajador(a) sexual.
- Contacto: Si / No.
- Embarazada: Si / No.
- Clasificacion de enfermedad.
- Enfermedad.
- Tipo de caso: Nuevo / Control.
- Observaciones.

Incluir una tabla lateral o inferior con registros recientes del mes.

Alertas sugeridas:

- Posible duplicado por expediente y fecha.
- Enfermedad no aplicable al sexo.
- Embarazada solo aplica para sexo mujer.
- Procedencia externa incompleta.

## Pantalla 3: Reporte ITS 2 del establecimiento

Crear una pantalla donde el establecimiento genera su reporte mensual consolidado.

Debe mostrar:

- Resumen del periodo.
- Estado del reporte: Borrador, En revision, Devuelto, Aprobado, Cerrado.
- Consolidado ITS 2 generado desde ITS 1.
- Totales por sexo.
- Totales por enfermedad.
- Nuevos y controles.
- Carga de total de atenciones para tasas.
- Validaciones de calidad antes de enviar.

Acciones:

- Recalcular ITS 2.
- Guardar borrador.
- Ver validaciones.
- Exportar Excel.
- Exportar PDF.
- Enviar a coordinacion municipal.

Validaciones visibles:

- Total de atenciones menor de 15: completo.
- Total de atenciones mayor o igual de 15: pendiente.
- Procedencias no reconocidas: 4.
- Posibles duplicados: 2.
- Diagnosticos con alerta: 1.

## Pantalla 4: Bandeja de revision municipal

Crear una pantalla para la Coordinacion Municipal de Puerto Cortes.

Importante: esta pantalla NO debe mostrar ITS 1 individual ni datos de expediente.

Debe mostrar reportes ITS 2 agregados por establecimiento.

Columnas sugeridas:

- Establecimiento.
- Periodo.
- Estado.
- Casos nuevos.
- Controles.
- Total ITS.
- Casos no AGI.
- Atenciones cargadas.
- Alertas.
- Fecha de envio.
- Acciones.

Acciones por reporte:

- Revisar consolidado.
- Aprobar.
- Devolver con observacion.
- Descargar Excel.
- Descargar PDF.

Agregar panel lateral de observaciones:

- Motivo de devolucion.
- Historial de estados.
- Usuario responsable.
- Fecha y hora.

Estados visuales:

- Pendiente de envio.
- En revision.
- Devuelto.
- Aprobado.
- Cerrado.

## Pantalla 5: Mapa operativo de Puerto Cortes

Crear una pantalla de mapa institucional.

Debe incluir:

- Mapa de Puerto Cortes con marcadores de establecimientos.
- Panel de filtros.
- Capas activables.
- Tarjetas KPI de procedencia y AGI.
- Tabla o panel con ranking de establecimientos.

Capas:

- Limite municipal.
- Establecimientos de salud.
- Produccion total.
- Cobertura real / AGI.
- Procedencias externas.
- Comunidades o barrios.

Filtros:

- Mes.
- Semana epidemiologica.
- Sexo.
- Edad o grupo de edad.
- Enfermedad.
- Clasificacion.
- Tipo de caso.
- Tipo de poblacion.
- Procedencia interna / externa.

KPIs de mapa:

- Produccion total atendida.
- Casos pertenecientes al AGI.
- Casos no pertenecientes al AGI.
- Casos de otro establecimiento del mismo municipio.
- Casos de otro municipio.
- Casos de otro departamento.
- Casos extranjeros.
- Casos con procedencia desconocida.

El mapa debe diferenciar dos vistas:

- Produccion total: cuanto atendio el establecimiento.
- Cobertura real / AGI: que ocurre en el territorio que le corresponde cubrir.

## Pantalla 6: Reportes y exportaciones

Crear una pantalla para generar, consultar y descargar reportes oficiales.

Tipos de reporte:

- ITS 1 Excel, solo para establecimiento autorizado.
- ITS 2 Excel.
- ITS 2 PDF.
- Consolidado municipal.
- Consolidado regional.
- Consolidado nacional.
- Evaluacion anual.
- Comparativo anual.

La pantalla debe mostrar:

- Lista de reportes generados.
- Estado de generacion.
- Plantilla utilizada.
- Version.
- Usuario que genero.
- Fecha.
- Formato.
- Boton descargar.

Estados:

- Pendiente.
- Generando.
- Generado.
- Error.

## Pantalla 7: Administracion territorial

Crear una pantalla para administrar la estructura operativa:

- Pais.
- Region/departamento.
- Municipio/coordinacion.
- Establecimientos.
- Comunidades o barrios.
- Areas de cobertura.

Debe mostrar:

- Arbol territorial Honduras -> Cortes -> Puerto Cortes -> establecimientos.
- Estado operativo: Preconfigurado, Creado, En pilotaje, Activo, Inactivo.
- Coordenadas de establecimientos.
- Validacion visual en mapa.
- Responsables asignados.
- Territorios incompletos.

Alertas:

- Establecimiento sin coordenadas.
- Municipio sin responsable.
- Region sin geometria.
- Usuario sin alcance asignado.
- Comunidad sin cobertura.

## Estilo visual deseado

El diseno debe sentirse como un sistema serio de gestion publica de salud.

Preferencias:

- Interfaz limpia, profesional y sobria.
- Densidad moderada de informacion.
- Sidebar fijo.
- Topbar con filtros globales.
- Tarjetas KPI compactas.
- Tablas claras.
- Estados con colores discretos.
- Mapas integrados como area principal, no como decoracion.
- Formularios organizados en secciones.
- Botones con iconos.
- Componentes consistentes.

Evitar:

- Landing page.
- Hero comercial.
- Gradientes llamativos.
- Ilustraciones decorativas sin funcion.
- Tarjetas enormes con poco contenido.
- Apariencia de app generica de ventas.
- Exponer datos individuales en pantallas municipales, regionales o centrales.

Paleta sugerida:

- Fondo general claro: blanco o gris muy claro.
- Verde institucional para salud y acciones positivas.
- Azul moderado para navegacion y confianza.
- Amarillo/ambar para advertencias.
- Rojo controlado para errores o reportes devueltos.
- Gris para estados neutros.

## Componentes clave

Usar componentes como:

- Sidebar.
- Topbar.
- Breadcrumbs.
- Selectores de periodo.
- Filtros desplegables.
- Tarjetas KPI.
- Badges de estado.
- Tablas con acciones.
- Formularios reactivos.
- Tabs.
- Panel lateral de detalle.
- Modales de confirmacion.
- Toasts o alertas.
- Mapa con capas.
- Graficas de barras y lineas.
- Timeline de historial de estados.

## Datos de ejemplo para el mockup

Usuario:

- Nombre: Dra. Ana Martinez.
- Rol: Coordinadora Municipal.
- Alcance: Puerto Cortes, Cortes.

Periodo:

- Julio 2026.
- Semana epidemiologica 29.

Establecimientos:

- CIS Cornelio Moncada Cordova.
- CIS Medina.
- UAPS Cieneguita.
- UAPS Baracoa.
- UAPS Rio Mar.
- UAPS Travesia.

Estados de reportes:

- CIS Cornelio Moncada Cordova: Aprobado.
- CIS Medina: En revision.
- UAPS Cieneguita: Devuelto.
- UAPS Baracoa: Pendiente de envio.
- UAPS Rio Mar: Aprobado.
- UAPS Travesia: En revision.

Enfermedades o categorias de ejemplo:

- Sindromico.
- Clinico.
- C/E.
- Etiologico.
- Sindrome de secrecion uretral.
- Ulcera genital.
- Condiloma acuminado.
- Vaginitis.

## Reglas importantes que el mockup debe reflejar

- ITS 1 individual solo esta disponible para el establecimiento.
- Municipio, region y central solo ven informacion consolidada.
- Todo envio, aprobacion, devolucion, exportacion o reapertura queda auditado.
- Los reportes enviados quedan congelados por version.
- Las correcciones se hacen mediante devolucion o reapertura autorizada.
- Las tasas solo se calculan si existen denominadores validos de atenciones.
- Los mapas respetan el rol y alcance territorial del usuario.
- El sistema debe diferenciar produccion total y cobertura real/AGI.

## Prompt corto para pegar en Stitch

Disena un mockup de una aplicacion web institucional llamada "Sistema de Gestion y Vigilancia ITS" para salud publica en Honduras. Debe automatizar captura ITS 1, generacion ITS 2, revision municipal, consolidacion regional/nacional, mapas, KPIs, reportes, exportaciones y auditoria. El piloto es Puerto Cortes, Cortes, con 12 establecimientos de salud.

La app debe tener sidebar, topbar con filtros de periodo y alcance, dashboard con KPIs, formulario de captura ITS 1, pantalla de reporte ITS 2, bandeja de revision municipal, mapa operativo con capas y filtros, reportes/exportaciones y administracion territorial. El estilo debe ser serio, profesional, institucional, claro y operativo; no debe parecer landing page ni app comercial.

Regla critica: el ITS 1 individual solo lo ve el establecimiento. Municipio, region y nivel central solo ven informacion consolidada. Mostrar estados de reporte como Borrador, En revision, Devuelto, Aprobado y Cerrado. Incluir mapas de Puerto Cortes, KPIs de produccion total, AGI, no AGI, procedencias externas, reportes pendientes y tasa ITS por 1000 atenciones.

Crear pantallas densas pero limpias, con tablas, tarjetas KPI compactas, badges de estado, filtros, graficas, paneles laterales, timeline de auditoria y acciones como Aprobar, Devolver, Exportar Excel, Exportar PDF y Enviar a coordinacion municipal.
