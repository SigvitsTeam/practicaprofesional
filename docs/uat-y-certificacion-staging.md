# UAT y certificación de staging

## Precondiciones

- PostgreSQL de staging restaurable y credenciales vigentes en `DATABASE_URL`/`DIRECT_URL`.
- Supabase Auth configurado con issuer, JWKS, clave de servicio y URL de redirección.
- migraciones aplicadas con `npm run db:migrate:deploy` y verificadas con `npm run db:verify-deployment`;
- worker de exportaciones ejecutándose con almacenamiento persistente compartido;
- catálogo oficial cargado y un usuario de prueba por cada rol institucional.

## Recorrido de aceptación

1. SuperAdmin crea territorio, Red y perfil; invita por correo y confirma auditoría.
2. Responsable registra, corrige y anula ITS-1; una versión ITS-2 enviada impide mutaciones tardías.
3. Coordinación municipal devuelve/aprueba ITS-2 y prepara el consolidado municipal.
4. Administración regional devuelve/aprueba municipios y prepara el consolidado regional.
5. Nivel Central devuelve/aprueba regiones, consolida, cierra y reabre con motivo.
6. Cada rol confirma que no puede consultar datos, territorios ni descargas fuera de su alcance.
7. XLSX/PDF territorial, ITS-1, ITS-2, consolidados y comparación anual se generan por worker, vencen y sólo los descarga su solicitante.
8. Redes muestra la suma reproducible de sus municipios y el historial administrativo autorizado.
9. Se reinicia API/worker durante trabajos pendientes y se confirma recuperación sin doble publicación.
10. Se restaura el backup en un entorno vacío y se ejecutan smoke tests de cierre mensual.

## Carga

Instale k6 en el agente de pruebas y ejecute desde `backend`:

```powershell
$env:BASE_URL='https://staging.example.org'
$env:ACCESS_TOKEN='<token de supervisor con alcance preparado>'
$env:TARGET_VUS='1000'
npm run load:critical
```

La puerta exige errores menores a 1%, `p95 < 500 ms` en lecturas comunes y todos los checks por
encima de 99%. Ejecute después una prueba separada de carreras sobre corrección ITS-1, membresías,
usuarios y cierres; debe existir un único ganador y el resto recibir conflicto sin corrupción.

## Evidencia obligatoria

- salida de migraciones, verificación de despliegue, smoke y k6;
- métricas de API, PostgreSQL y worker durante la carga;
- captura de eventos de auditoría y artefactos exportados;
- acta UAT firmada por cada rol, incidencias, decisión de salida y procedimiento de rollback probado.
