# Frontend

## Autenticación

La aplicación inicia en una pantalla de acceso. La configuración pública se encuentra en
`src/environments/environment.ts`: al definir `supabaseUrl` y `supabaseAnonKey` se utiliza
Supabase Auth; mientras estén vacíos queda disponible el usuario de demostración.

El token se renueva antes de expirar y el interceptor HTTP lo envía únicamente a `apiUrl`.
El backend continúa siendo la autoridad de roles, permisos y alcance territorial.

Antes de un despliegue real se debe desactivar `demoEnabled` y suministrar la configuración
de Supabase mediante el mecanismo de entornos del despliegue.

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
