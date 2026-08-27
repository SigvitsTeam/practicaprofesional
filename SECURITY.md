# Política de seguridad

SIGVITS procesa información sanitaria. No publique vulnerabilidades, credenciales, expedientes ni
capturas con datos personales en incidencias abiertas.

## Reporte responsable

Reporte el hallazgo al responsable de seguridad institucional por el canal privado aprobado. Incluya
versión afectada, impacto, pasos mínimos de reproducción y mitigación propuesta. No incluya datos de
pacientes; use identificadores sintéticos. El equipo debe acusar recibo, clasificar severidad, definir
contención y documentar la corrección antes de divulgar detalles.

## Credenciales

- Los secretos de backend se inyectan desde el gestor de secretos o archivos Docker montados en
  `/run/secrets`; nunca se almacenan en Git, imágenes, argumentos de compilación o configuración
  pública de Angular.
- El token que protege `/metrics` se entrega mediante `metrics_bearer_token.txt`; API y worker no lo
  reciben como texto en el archivo de entorno ni en la definición del contenedor.
- La API usa un rol PostgreSQL de runtime sin propiedad ni DDL. El rol de migración/backup se reserva
  para tareas administrativas y toda conexión a una base remota exige TLS.
- La clave publicable de Supabase no es un secreto, pero RLS y el backend siguen siendo la barrera de
  autorización. La clave `service_role` sólo puede existir como `AUTH_ADMIN_SECRET` en el backend.
- Ante una exposición: revocar y rotar primero, revisar auditoría y sesiones, desplegar credenciales
  nuevas y documentar el incidente. Eliminar el archivo del último commit no revoca el secreto.

## Versiones soportadas

Sólo la versión desplegada y la candidata de release reciben correcciones. Cada release debe superar
CI, revisión de dependencias, UAT, restauración y aprobación de salida documentada.
