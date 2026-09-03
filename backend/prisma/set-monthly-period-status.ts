// Retired entry point. Keep this fail-closed stub so script builds also replace
// stale compiled copies of the former direct state-changing command.
process.stderr.write(
  'Este comando fue retirado. Use Administración → Períodos para aperturas y Consolidados para cierres/reaperturas oficiales. No se modificó ningún período.\n',
);
process.exitCode = 1;
