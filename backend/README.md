# Backend SIGVITS

Base del backend institucional construida como monolito modular con NestJS. NestJS es la
autoridad de reglas de negocio; PostgreSQL será la persistencia portable y Supabase solamente
el proveedor inicial.

## Requisitos

- Node.js 22 o superior.
- npm 11 o superior.

## Ejecución local

```bash
copy .env.example .env
npm install
npm run start:dev
```

- Salud: `GET http://localhost:3000/api/health`
`CORS_ORIGINS` debe contener una lista explícita separada por comas; no se admite el comodín
como configuración recomendada.

## Verificación

```bash
npm run check
```

El comando valida formato, reglas estáticas, pruebas unitarias, pruebas HTTP y compilación.

## Arquitectura

Cada dominio crecerá con la dirección de dependencias siguiente:

```text
HTTP/Controller -> Aplicación/Caso de uso -> Dominio <- Puertos
                                                   <- Adaptadores PostgreSQL, colas y storage
```

- Los controladores traducen HTTP; no contienen reglas institucionales.
- El dominio no importa Prisma, Supabase, Redis, ExcelJS ni detalles de transporte.
- Los adaptadores implementan puertos definidos hacia adentro.
- Las consultas individuales ITS 1 y las agregadas ITS 2 usan casos de uso y contratos distintos.
- La autorización evalúa permiso + territorio + nivel de dato. El rol por sí solo nunca autoriza.
- Los logs HTTP no incluyen query strings, cuerpos, números de expediente ni datos clínicos.

## Decisiones vigentes aplicadas

- `DIGITADOR_ESTABLECIMIENTO` está eliminado; se usa `DIGITADOR_COORDINACION`.
- La procedencia de ITS 1 es texto libre. AGI y sus campos derivados están fuera del alcance vigente.
- Las redes son agrupaciones configurables y no agregan una etapa al flujo de aprobación.
- Un SuperAdmin o SuperAdmin Regional no obtiene acceso implícito a ITS 1.

El documento `docs/modelo-base-datos-its.md` todavía contiene referencias anteriores a AGI y al
rol eliminado. No deben trasladarse a migraciones sin armonizar primero ese documento con las
decisiones del 3 y 4 de agosto de 2026.

## Controles presentes desde el arranque

- Configuración validada y fallo temprano ante valores inválidos.
- CORS explícito, cabeceras Helmet y límite configurable de cuerpo.
- Rate limiting global; en despliegues tras proxy se debe configurar `TRUST_PROXY` conscientemente.
- DTOs con lista blanca y rechazo de propiedades desconocidas.
- Identificador de correlación por petición.
- Errores RFC 7807 sin filtrar stack traces al cliente.
- Política de autorización con denegación por defecto y pruebas de privacidad.

Autenticación real, persistencia, auditoría inmutable, Redis/BullMQ y almacenamiento se añadirán en
incrementos verticales. La existencia de esta base no debe interpretarse como preparación completa
para producción: antes de ello también se requieren gestión de secretos, TLS, backups restaurados,
MFA para perfiles privilegiados, observabilidad y pruebas de carga/seguridad.

La generación interactiva de OpenAPI se mantiene fuera del runtime inicial porque las versiones
disponibles de su cadena `js-yaml` presentan avisos de denegación de servicio. Se reintroducirá al
existir una combinación sin vulnerabilidades conocidas; los contratos de cada caso de uso seguirán
siendo obligatorios.
