import { passwordProblem, readEmailAction } from './email-action';

describe('Email action parsing', () => {
  it('leaves normal navigation intact', () => {
    expect(readEmailAction(new URL('https://sigvits.example/?page=users#help'))).toEqual({
      input: { kind: 'none' },
      cleanUrl: '/?page=users#help',
    });
  });
  it.each(['invite', 'recovery'])('accepts %s and removes all URL credentials', (action) => {
    const result = readEmailAction(
      new URL(
        `https://sigvits.example/?auth=${action}#access_token=qa-token&refresh_token=qa-refresh&expires_in=3600&token_type=bearer&type=${action}`,
      ),
    );
    expect(result.input).toEqual({
      kind: 'session',
      action,
      accessToken: 'qa-token',
      expiresIn: 3600,
    });
    expect(result.cleanUrl).toBe('/');
  });
  it('supports a custom token-hash template without following its redirect', () => {
    const result = readEmailAction(
      new URL(
        'https://sigvits.example/?token_hash=0123456789abcdef&type=recovery&next=https://untrusted.example',
      ),
    );
    expect(result.input).toEqual({
      kind: 'token',
      action: 'recovery',
      tokenHash: '0123456789abcdef',
    });
    expect(result.cleanUrl).not.toContain('token_hash');
  });
  it.each([
    '#access_token=qa&expires_in=3600&token_type=bearer&type=signup',
    '#access_token=qa&expires_in=0&token_type=bearer&type=recovery',
    '#access_token=qa&expires_in=NaN&token_type=bearer&type=recovery',
    '#access_token=qa&expires_in=3600&type=recovery',
    '?access_token=qa&expires_in=3600&token_type=bearer&type=recovery',
    '?auth=invite',
    '?code=unsupported-pkce',
    '?token_hash=short&type=invite',
    '#error=access_denied&error_code=otp_expired&error_description=untrusted-message',
  ])('rejects malformed, expired or unsupported links and scrubs them (%s)', (suffix) => {
    const result = readEmailAction(new URL(`https://sigvits.example/${suffix}`));
    expect(result.input.kind).toBe('invalid');
    expect(result.cleanUrl).toBe('/');
  });
});

describe('New password validation', () => {
  it.each([
    ['short', 'short', '12 caracteres'],
    ['una frase larga qa', 'distinta', 'no coinciden'],
    [' '.repeat(12), ' '.repeat(12), 'únicamente espacios'],
    ['a'.repeat(129), 'a'.repeat(129), '128 caracteres'],
  ])('rejects invalid passwords without a network call', (password, confirmation, message) => {
    expect(passwordProblem(password, confirmation)).toContain(message);
  });
  it('allows a matching long passphrase', () => {
    expect(passwordProblem('frase de prueba sintética', 'frase de prueba sintética')).toBeNull();
  });
});
