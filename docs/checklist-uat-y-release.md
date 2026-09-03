# Checklist de UAT y release

Copie este documento por release y adjunte enlaces o rutas inmutables. Una casilla sin evidencia no
cuenta como aprobada. Datos de prueba sintéticos; nunca anexar expedientes o credenciales reales.

## Identificación

| Campo                                          | Evidencia |
| ---------------------------------------------- | --------- |
| Release / commit / fecha                       | Pendiente |
| Digest API / worker / frontend                 | Pendiente |
| Ambiente, dataset y versión PostgreSQL         | Pendiente |
| Responsable técnico / QA / seguridad / negocio | Pendiente |
| Ventana y tag de rollback                      | Pendiente |

## Puertas automatizadas

- [ ] CI verde: formato, lint backend y frontend, pruebas unitarias y E2E HTTP.
- [ ] Builds de producción y presupuestos Angular aprobados.
- [ ] `prisma validate`, CI con PostgreSQL/PostGIS real, migración desde snapshot representativo,
      readiness y `db:verify-deployment` aprobados.
- [ ] Auditoría de dependencias sin vulnerabilidades altas/críticas no aceptadas.
- [ ] SBOM, identificador/digest y escaneo de API, worker, migrador y frontend archivados.
- [ ] Escaneo de secretos limpio y ninguna credencial en Git, artefactos o logs.

## UAT funcional por rol

| Rol                         | Recorrido positivo                                          | Denegaciones fuera de alcance                   | Responsable | Evidencia / resultado |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ----------- | --------------------- |
| Responsable establecimiento | Captura, corrección, anulación, ITS-1/ITS-2 y exportación   | Otro establecimiento y período cerrado          | Pendiente   | Pendiente             |
| Digitador coordinación      | Captura dentro del alcance asignado                         | Establecimiento no asignado                     | Pendiente   | Pendiente             |
| Coordinador municipal       | Bandeja, devolución, aprobación y consolidado               | Otro municipio / ITS-1 individual no autorizado | Pendiente   | Pendiente             |
| SuperAdmin regional         | Territorio, red, usuarios, auditoría y consolidado regional | Otra región / dato individual sin permiso       | Pendiente   | Pendiente             |
| Admin central               | Revisión regional, consolidado nacional y cierre            | Acción sin permiso o estado previo inválido     | Pendiente   | Pendiente             |
| SuperAdmin                  | Administración global e identidad                           | Repetición, versión obsoleta y payload inválido | Pendiente   | Pendiente             |

## Identidad y acceso por correo

- [ ] Invitación real recibida por un buzón autorizado, enlace verificado y contraseña definida.
- [ ] Recuperación real recibida, contraseña cambiada, login anterior rechazado y nuevo login válido.
- [ ] Enlaces vencidos/reutilizados rechazados; cuenta inactiva no obtiene acceso institucional.
- [ ] SMTP, remitente y redirecciones HTTPS configurados en el ambiente que se va a publicar.
- [ ] Cabecera, filtros y diálogos revisados en dispositivos objetivo, incluidos errores de envío.

Configuración y recorrido: [runbook de invitaciones y recuperación](runbook-invitaciones-y-recuperacion.md).

## Reglas clínicas y privacidad

- [ ] Hombre no puede seleccionar ni enviar patologías exclusivas de mujer.
- [ ] Mujer no puede seleccionar ni enviar patologías exclusivas de hombre.
- [ ] Cambio de sexo limpia diagnósticos incompatibles en UI; API y base rechazan bypass.
- [ ] Registros, logs, errores y auditoría no exponen datos clínicos innecesarios.
- [ ] Política institucional para conteos bajos verificada en API, mapa, dashboard y exportaciones.
- [ ] Descargas pertenecen al solicitante, respetan alcance y vencen.

## Concurrencia, rendimiento y resistencia

- [ ] Carreras de corrección, anulación, cierre, membresías y usuarios tienen un ganador y conflictos
      controlados, sin escritura parcial.
- [ ] k6 ejecutado con población certificada: error < 1%, checks > 99%, lectura p95 < 500 ms y
      escritura p95 < 1 s, salvo trabajos asíncronos.
- [ ] Pool, conexiones, locks, CPU, memoria y backlog permanecen dentro de límites durante carga y soak.
- [ ] Reinicio API/worker recupera trabajos pendientes sin doble publicación.
- [ ] Healthcheck del worker consulta `:3001/health/ready`; no se acepta sólo comprobar que PID 1 vive.
- [ ] Backup restaurado en vacío; RPO/RTO, integridad, RLS y smoke aprobados.

## Operación y seguridad

- [ ] TLS, DNS, CORS, proxy confiable, CSP, límites y rate limiting verificados desde el exterior.
- [ ] Métricas RED, salud DB, backlog/edad del worker y capacidad de volumen tienen alertas probadas.
- [ ] MFA de privilegiados, rotación, mínimo privilegio y contactos de incidente confirmados.
- [ ] Accesibilidad WCAG, teclado y navegadores/dispositivos objetivo aprobados.
- [ ] Rollback de imágenes practicado con tag inmutable y runbook cronometrado.

## Decisión

| Decisión               | Nombre / fecha / firma o aprobación electrónica | Condiciones |
| ---------------------- | ----------------------------------------------- | ----------- |
| Negocio                | Pendiente                                       | Pendiente   |
| QA                     | Pendiente                                       | Pendiente   |
| Seguridad / privacidad | Pendiente                                       | Pendiente   |
| Operaciones / DBA      | Pendiente                                       | Pendiente   |
| Go / No-Go final       | Pendiente                                       | Pendiente   |

Todo hallazgo abierto debe indicar severidad, compensación, propietario y vencimiento. Un P0/P1 de
integridad, autorización, privacidad, recuperación o disponibilidad bloquea la salida.
