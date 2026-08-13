export interface VerifiedIdentity {
  issuer: string;
  subject: string;
}

export abstract class TokenVerifier {
  abstract verify(token: string): Promise<VerifiedIdentity>;
}

export class InvalidAccessTokenError extends Error {
  constructor() {
    super('El token de acceso no es válido.');
    this.name = InvalidAccessTokenError.name;
  }
}

export class IdentityProviderUnavailableError extends Error {
  constructor() {
    super('El servicio de verificación de identidad no está disponible.');
    this.name = IdentityProviderUnavailableError.name;
  }
}
