-- Read-only permission. Clinical, administrative and other territorial grants are unchanged.
INSERT INTO "rol_permiso" ("rol_id", "permiso_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permisos" p
WHERE r."codigo" = 'COORDINADOR_MUNICIPAL'
  AND p."codigo" = 'territorial:networks:read'
ON CONFLICT DO NOTHING;
