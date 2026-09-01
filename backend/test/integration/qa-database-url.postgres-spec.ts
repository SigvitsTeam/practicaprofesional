import { requireQaDatabaseUrl } from './qa-database';

describe('QA database safety boundary', () => {
  it.each([
    undefined,
    'postgresql://user:ci-only@db.example.com/sigvits_qa',
    'postgresql://user:ci-only@127.0.0.1/postgres',
    'postgresql://user:ci-only@127.0.0.1/sigvits',
    'postgresql://user:ci-only@127.0.0.1/sigvits_qa?host=db.example.com',
    'postgresql://user:ci-only@127.0.0.1/sigvits_qa?dbname=sigvits',
    'postgresql://user:ci-only@127.0.0.1/sigvits_qa#fragment',
    'https://127.0.0.1/sigvits_qa',
  ])('rejects unsafe or missing QA connection %s', (value) => {
    expect(() => requireQaDatabaseUrl(value)).toThrow();
  });

  it.each(['127.0.0.1', 'localhost', '[::1]'])('accepts explicit isolated QA on %s', (host) => {
    expect(
      requireQaDatabaseUrl(`postgresql://user:ci-only@${host}:55432/sigvits_qa_concurrency`)
        .hostname,
    ).toBe(host);
  });
});
