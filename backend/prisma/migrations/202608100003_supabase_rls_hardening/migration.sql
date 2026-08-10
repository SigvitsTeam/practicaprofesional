DO $$
DECLARE
  table_name text;
  protected_tables text[] := ARRAY[
    'programas_salud',
    'regiones',
    'redes_salud',
    'municipios',
    'red_municipios',
    'establecimientos_salud',
    'auditoria_eventos',
    'usuarios',
    'identidades_externas',
    'roles',
    'permisos',
    'rol_permiso',
    'usuario_roles',
    'usuario_asignaciones'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', table_name);
  END LOOP;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM authenticated;

REVOKE ALL ON FUNCTION public.validate_network_municipality_region() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_health_facility_geom() FROM PUBLIC;

COMMENT ON SCHEMA public IS
  'SIGVITS: acceso operativo exclusivamente mediante NestJS; Data API sin políticas públicas.';
