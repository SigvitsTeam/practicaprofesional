# Despliegue del frontend en Vercel

El frontend Angular se publica en Vercel. La API NestJS y el worker de exportaciones
necesitan un servicio persistente con almacenamiento compartido para los archivos de
exportación, según la arquitectura actual. Publicar solo Angular no pone en línea la API.
La configuración Docker existente está en `deploy/compose.yaml` y sus variantes.

## Importar el proyecto

1. Subir a GitHub los cambios que se quieran desplegar, incluida esta configuración.
2. En https://vercel.com/new importar `Alejandro-ZG/practicaprofesional`.
3. Seleccionar **Root Directory: frontend**, **Framework: Angular** y **Node.js: 24.x**.
4. Mantener los valores definidos por `frontend/vercel.json`:
   - Install Command: `npm ci`.
   - Build Command: `npm run config:runtime && npm run build -- --configuration production`.
   - Output Directory: `dist/frontend/browser`.
5. Configurar las variables siguientes en Production y en los entornos Preview que se utilicen.

| Variable | Valor |
| --- | --- |
| `SIGVITS_API_URL` | URL HTTPS pública de NestJS, incluyendo `/api`, por ejemplo `https://api.example.org/api` |
| `SUPABASE_URL` | URL del proyecto Supabase utilizado por el backend |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública publishable o anon de ese proyecto |

Estas variables se incorporan a un JSON público del frontend. No agregar `DATABASE_URL`,
`DIRECT_URL`, claves secretas ni `service_role` al frontend. Las credenciales del backend
se configuran exclusivamente en su alojamiento.

El build en Vercel exige una URL HTTPS de API; no permite omitirla y publicar accidentalmente
la dirección de localhost. El modo demostración queda deshabilitado.

6. Desplegar y agregar el origen exacto del sitio (por ejemplo `https://sigvits.vercel.app`)
   a `CORS_ORIGINS` del backend, conservando los orígenes existentes necesarios.
7. Si se utilizan enlaces de recuperación o redirecciones de Supabase Auth, configurar
   también la URL del sitio y las URL de redirección autorizadas en Supabase.

Cada cambio de variables requiere un nuevo despliegue porque el JSON se genera durante el build.
Los previews necesitan su propio origen permitido por el backend para poder llamar a la API.

## Verificar el despliegue

- Abrir `/config/runtime-config.json`: debe devolver JSON con la API pública correcta.
- Abrir una ruta interna y recargar: debe servir Angular sin error 404.
- Comprobar `/api/health` y `/api/health/ready` en el dominio del backend.
- Iniciar sesión y verificar una consulta autorizada sin errores CORS.
- Solicitar y descargar una exportación para comprobar también el worker y su almacenamiento.

Referencia: https://vercel.com/docs/project-configuration/vercel-json
