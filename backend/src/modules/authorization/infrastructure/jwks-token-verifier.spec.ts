import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { InvalidAccessTokenError } from '../application/token-verifier';
import { JwksTokenVerifier } from './jwks-token-verifier';

describe('JwksTokenVerifier', () => {
  let server: Server | undefined;
  let issuer: string;
  let validToken: string;

  beforeAll(async () => {
    const jose = await import('jose');
    const { privateKey, publicKey } = await jose.generateKeyPair('ES256');
    const publicJwk = await jose.exportJWK(publicKey);
    Object.assign(publicJwk, { kid: 'test-key-1', alg: 'ES256', use: 'sig' });

    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [publicJwk] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    issuer = `http://127.0.0.1:${address.port}`;
    validToken = await new jose.SignJWT({ purpose: 'test' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-1' })
      .setIssuer(issuer)
      .setAudience('sigvits-api')
      .setSubject('external-user-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function verifier(audience = 'sigvits-api'): JwksTokenVerifier {
    return new JwksTokenVerifier(
      new ConfigService({
        auth: {
          issuer,
          audience,
          jwksUrl: `${issuer}/.well-known/jwks.json`,
          clockToleranceSeconds: 0,
          jwksTimeoutMs: 2_000,
        },
      }),
    );
  }

  it('verifies an ES256 signature and required identity claims through JWKS', async () => {
    await expect(verifier().verify(validToken)).resolves.toEqual({
      issuer,
      subject: 'external-user-1',
    });
  });

  it('rejects a correctly signed token issued for another audience', async () => {
    await expect(verifier('other-api').verify(validToken)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});
