import { ROLE_PROFILES } from './role-data';

describe('role navigation for preliminary ITS2 consultation', () => {
  it.each(['central-validator', 'regional-admin', 'municipal-coordinator'] as const)(
    'shows Reporte ITS 2 for %s',
    (roleId) => {
      expect(ROLE_PROFILES.find((role) => role.id === roleId)?.navItems).toContain('Reporte ITS 2');
    },
  );

  it('does not expose ITS 1 capture to preliminary consultation roles', () => {
    for (const roleId of ['central-validator', 'regional-admin', 'municipal-coordinator'] as const)
      expect(ROLE_PROFILES.find((role) => role.id === roleId)?.navItems).not.toContain(
        'Captura ITS 1',
      );
  });
});
