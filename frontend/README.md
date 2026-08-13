# Frontend

## Acceso y autenticación

La aplicación inicia en una pantalla de acceso y conserva la sesión en `sessionStorage`, o en
`localStorage` cuando el usuario selecciona **Recordarme**. Para el prototipo local está habilitado
un botón de acceso de demostración.

La configuración se encuentra en `src/environments/environment.ts`. Al definir `supabaseUrl` y
`supabaseAnonKey`, el mismo formulario utiliza Supabase Auth (correo y contraseña) y desactiva el
acceso visual de demostración. El backend continúa siendo la autoridad de roles, permisos y alcance
territorial; el JWT del proveedor solamente acredita la identidad.

Antes de desplegar se debe deshabilitar `demoEnabled`, suministrar la configuración pública mediante
el mecanismo de entornos del despliegue y completar la renovación automática del access token.

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
