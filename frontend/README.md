# Frontend

## Despliegue en Vercel

La configuración está en `vercel.json`. Consulte [la guía de despliegue](../docs/despliegue-vercel.md)
para las variables públicas y la conexión con el backend.

## Autenticación

La aplicación carga su configuración pública desde `public/config/runtime-config.json`. Este
archivo está ignorado por Git y permite cambiar API o proyecto Supabase sin recompilar.

Para crearlo localmente, defina la URL y la clave pública `publishable` (o la clave `anon`
legada) del proyecto y ejecute:

```powershell
$env:SUPABASE_URL='https://project-id.supabase.co'
$env:SUPABASE_PUBLISHABLE_KEY='sb_publishable_...'
npm run config:runtime
```

También puede copiar `public/config/runtime-config.example.json` manualmente. Cuando URL y clave
están presentes, el modo demostración queda desactivado automáticamente.

El token se renueva antes de expirar y el interceptor HTTP lo envía únicamente a `apiUrl`.
El backend continúa siendo la autoridad de roles, permisos y alcance territorial.

Nunca use ni publique la clave `service_role` en Angular. El archivo runtime solo acepta una clave
pública destinada a aplicaciones cliente.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
