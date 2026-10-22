# Render: API, worker y migraciones

El servicio Docker usa la rama `main`, raíz vacía, contexto `.` y
`deploy/docker/railway-demo.Dockerfile`. El nombre del archivo se conserva para
mantener la configuración existente de Render.

Mantener Docker Command vacío. El comando predeterminado ejecuta
`prisma migrate deploy` antes de iniciar API y worker. Una migración fallida
impide iniciar ambos procesos. No requiere Pre-Deploy Command.

Configurar DIRECT_URL en Environment con una conexión de Supabase apta para
migraciones y permisos para cambiar el esquema. DATABASE_URL corresponde a la
conexión del backend. Usar TLS y conservar estas credenciales fuera de Git.
La configuración Prisma prefiere DIRECT_URL y usa DATABASE_URL si falta.

Con Auto-Deploy en On Commit, cada despliegue que use esta imagen comprobará
las migraciones pendientes al arrancar. Los reinicios también ejecutan la
comprobación; Prisma registra y omite las migraciones ya aplicadas.

Verificar en los logs que Prisma terminó sin errores antes del inicio de NestJS
y comprobar `/api/health/ready`. Las migraciones modifican la base compartida:
revisarlas antes de publicar y mantener compatibilidad con la versión anterior
durante el despliegue.
