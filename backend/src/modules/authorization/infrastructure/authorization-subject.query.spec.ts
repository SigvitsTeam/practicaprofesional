import { authorizationSubjectQuery } from './authorization-subject.query';
import { managedUserListQuery } from '../../user-admin/infrastructure/managed-user-list.query';

describe('Access query parameterization', () => {
  it('binds issuer and subject rather than interpolating SQL', () => {
    const untrusted = "' OR TRUE --";
    const query = authorizationSubjectQuery(untrusted, untrusted, new Date('2026-09-02T00:00:00Z'));
    expect(query.text).not.toContain(untrusted);
    expect(query.values.slice(0, 2)).toEqual([untrusted, untrusted]);
  });

  it('binds all regional filters, including values used in each hierarchy branch', () => {
    const ids = ['00000000-0000-4000-8000-000000000001', "' OR TRUE --"];
    const query = managedUserListQuery(new Date(), ids);
    for (const id of ids) {
      expect(query.text).not.toContain(id);
      expect(query.values.filter((value) => value === id)).toHaveLength(3);
    }
  });
});
