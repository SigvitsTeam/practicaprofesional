export type EmailActionKind = 'invite' | 'recovery';
export type EmailActionInput =
  | { kind: 'none' }
  | { kind: 'invalid'; action: EmailActionKind }
  | { kind: 'session'; action: EmailActionKind; accessToken: string; expiresIn: number }
  | { kind: 'token'; action: EmailActionKind; tokenHash: string };

const LINK_PARAMETERS = [
  'access_token',
  'refresh_token',
  'token_type',
  'expires_in',
  'expires_at',
  'type',
  'token_hash',
  'code',
  'error',
  'error_code',
  'error_description',
  'auth',
];

/** Only supported email flows are accepted; URL content never selects an API host. */
export function readEmailAction(url: URL): { input: EmailActionInput; cleanUrl: string } {
  const fragment = new URLSearchParams(url.hash.slice(1));
  const rawAction =
    fragment.get('type') ?? url.searchParams.get('type') ?? url.searchParams.get('auth');
  const action: EmailActionKind = rawAction === 'invite' ? 'invite' : 'recovery';
  const hasAction = LINK_PARAMETERS.some((key) => fragment.has(key) || url.searchParams.has(key));
  let input: EmailActionInput = { kind: 'none' };
  if (hasAction) {
    input = { kind: 'invalid', action };
    const failed =
      fragment.has('error') ||
      fragment.has('error_code') ||
      url.searchParams.has('error') ||
      url.searchParams.has('error_code');
    if (!failed && (rawAction === 'invite' || rawAction === 'recovery')) {
      const accessToken = fragment.get('access_token');
      const expiresIn = Number(fragment.get('expires_in'));
      const tokenHash = url.searchParams.get('token_hash');
      if (
        accessToken &&
        accessToken.length <= 16384 &&
        fragment.get('token_type') === 'bearer' &&
        Number.isInteger(expiresIn) &&
        expiresIn > 0 &&
        expiresIn <= 86400
      ) {
        input = { kind: 'session', action, accessToken, expiresIn };
      } else if (tokenHash && /^[a-zA-Z0-9_-]{16,512}$/.test(tokenHash)) {
        input = { kind: 'token', action, tokenHash };
      }
    }
    for (const key of LINK_PARAMETERS) url.searchParams.delete(key);
    url.hash = '';
  }
  return { input, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
}

export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < 12) return 'Utiliza al menos 12 caracteres para la contraseña nueva.';
  if (password.length > 128) return 'La contraseña no puede superar los 128 caracteres.';
  if (!password.trim()) return 'La contraseña no puede contener únicamente espacios.';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}
