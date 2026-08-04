# Decisiones de roles — 4 de agosto de 2026

Este documento registra decisiones vigentes sobre los usuarios y su alcance territorial. Tiene precedencia sobre descripciones anteriores que no incluyan el rol SuperAdmin Regional.

## Ajuste de roles de captura

- Se conserva el rol **Responsable de Establecimiento**.
- Se conserva el rol **Digitador de Coordinación** definido en `decisiones-frontend-2026-08-03.md`.
- Se elimina el rol **Digitador de Establecimiento**.
- No debe diseñarse una vista, menú, permiso ni flujo independiente para el rol eliminado.

El Responsable de Establecimiento trabaja únicamente con su establecimiento asignado. El Digitador de Coordinación puede seleccionar uno de los establecimientos bajo la coordinación y trabajar en nombre del establecimiento seleccionado, de acuerdo con sus permisos.

## SuperAdmin Regional

Existirá un rol denominado **SuperAdmin Regional**.

Este usuario combina:

1. Todas las funciones operativas del Admin Regional.
2. Las capacidades administrativas del SuperAdmin, limitadas exclusivamente a su región asignada y a los niveles que dependen de ella.

Su alcance se representa así:

```text
Región asignada
├── Redes de salud
│   └── Municipios asociados
└── Municipios / coordinaciones municipales
    └── Establecimientos de salud
        └── Usuarios con alcance local
```

### Funciones operativas regionales

- Revisar consolidados municipales y reportes agregados.
- Devolver información al municipio con observaciones.
- Aprobar consolidados municipales.
- Generar el consolidado regional.
- Enviar el consolidado regional al nivel central.
- Consultar indicadores, reportes y el mapa dentro de su región.

### Funciones administrativas dentro de su alcance

- Administrar los datos configurables de su propia región.
- Crear, editar, activar o desactivar municipios y coordinaciones municipales de su región.
- Crear, editar, activar o desactivar redes dentro de su región y administrar sus municipios asociados.
- Crear, editar, activar o desactivar establecimientos pertenecientes a esos municipios.
- Gestionar usuarios de la región, municipios y establecimientos bajo su responsabilidad.
- Asignar roles y permisos cuyo alcance no exceda su región.
- Gestionar catálogos, plantillas, semanas epidemiológicas y configuraciones regionales cuando admitan personalización territorial.
- Gestionar la ubicación y datos geográficos de municipios y establecimientos de su región.
- Ejecutar reaperturas o acciones excepcionales dentro de su alcance, siempre con motivo obligatorio y auditoría.

### Restricciones

- No puede administrar otras regiones.
- No puede crear, modificar o eliminar usuarios con alcance nacional ni SuperAdmin del sistema.
- No puede cambiar configuraciones, catálogos o plantillas definidos como globales por el nivel central.
- No sustituye al Nivel Central ni puede aprobar el consolidado nacional.
- El rol no concede por sí mismo acceso a registros individuales ITS 1.
- Toda acción administrativa sensible debe quedar registrada en auditoría.

## Regla de autorización

Las autorizaciones no deben depender únicamente del nombre del rol. Siempre se evaluará:

```text
Rol + región asignada + territorio objetivo + nivel de dato + acción solicitada
```

El SuperAdmin Regional podrá actuar solamente cuando el territorio objetivo sea su propia región o un descendiente de ella.
