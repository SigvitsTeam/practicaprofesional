# Administración de períodos mensuales

## Acceso y operación

Un **SuperAdmin** o **Admin Central**, con alcance nacional y el permiso
`reporting:periods:manage`, entra en **Administración → Períodos**. Para Admin Central
la sección de períodos aparece directamente. Los demás roles no pueden administrar
calendarios, aunque sí consultar el período operativo que les corresponda.

1. Seleccione el año (2020–2100) y pulse **Crear / completar calendario**.
2. Escriba un motivo administrativo de 10–500 caracteres y confirme el alcance nacional.
   Se generan únicamente los meses y semanas faltantes. Los meses nuevos quedan
   **BLOQUEADOS**: crear el año no habilita captura.
3. Para habilitar todo el año, pulse **Abrir todos los meses de [año]** y confirme una
   sola vez el motivo y el alcance nacional. Se abren juntos los meses bloqueados; los
   ya abiertos y los que tienen cierre oficial no cambian. Se requiere un calendario
   completo de doce meses y semanas activas para los meses que se abrirán.
   Si sólo necesita un mes, use **Abrir mes**. Ambas opciones respetan los permisos
   de captura de cada usuario.
4. Consulte **Historial** para ver quién creó/abrió el mes, cuándo y con qué motivo.

No existe apertura automática por cambio de fecha ni se cierra el mes anterior al abrir
otro. Puede haber varios meses abiertos si así lo decide la autoridad nacional.
El módulo no modifica meses existentes al completar un año ni abre meses en modo demo.

## Estados y responsabilidades

| Estado | Significado | Cambio permitido |
| --- | --- | --- |
| BLOQUEADO | Captura no habilitada | Abrir desde Administración → Períodos |
| ABIERTO | Captura habilitada según permisos y reglas del flujo ITS | Cierre oficial desde el consolidado nacional |
| CERRADO | Mes con cierre oficial | Reapertura excepcional desde Consolidados, no desde Administración |

La apertura exige cobertura completa del mes con semanas epidemiológicas activas.
La regla empleada es domingo a sábado; la primera semana del año contiene al menos
cuatro días de enero, según el [calendario epidemiológico de OPS](https://www.paho.org/sites/default/files/2016-cha-calendario-epidemiologico.pdf).
Las semanas que cruzan diciembre/enero se comparten entre ambos calendarios. Si las
fechas existentes difieren de esta regla o hay semanas inactivas, el sistema detiene
la creación para su revisión; nunca las sobrescribe silenciosamente.

## Seguridad y concurrencia

- Permiso, rol y alcance se comprueban en el backend; ocultar un botón no es la protección.
- Calendarios concurrentes se serializan con un bloqueo transaccional PostgreSQL.
- Cada mes es único por año/mes en la base de datos y se inserta bloqueado por defecto.
- La apertura bloquea la fila y compara su versión antes de cambiar el estado. Ante un
  conflicto, actualice el listado y revise el nuevo estado antes de volver a confirmar.
- La apertura anual compara las versiones de los doce meses, bloquea sus filas en orden
  estable y registra una auditoría por cada mes cambiado. Si falla cualquier validación
  o auditoría, revierte toda la operación, sin dejar el año parcialmente abierto.
- El cambio y su auditoría se confirman en la misma transacción. Un fallo revierte ambos.
- El antiguo comando de cambio directo de estado fue retirado: no debe usarse SQL manual
  para saltarse la decisión administrativa ni el cierre oficial.

## Activación técnica

1. Ejecute `npm run db:verify-periods` en `backend` con la conexión administrativa configurada.
   Debe devolver `duplicateGroups: 0` e `invalidMonthlyPeriods: 0`.
2. Verifique la migración y la suite PostgreSQL en la base desechable de QA.
3. Aplique las migraciones mediante el procedimiento habitual de despliegue. La migración
   `202609030001_period_administration` agrega el permiso y las restricciones; no abre ni
   cierra períodos reales.
4. Reinicie el backend actualizado y vuelva a iniciar sesión para renovar el perfil/permisos.
5. Realice la apertura únicamente con autorización institucional para el mes correspondiente.

Una instalación sin meses permite a un administrador nacional autorizado entrar a esta
sección para crear el calendario. Los roles operativos permanecen bloqueados hasta que
exista un catálogo válido.
