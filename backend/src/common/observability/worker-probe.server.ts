import { timingSafeEqual } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { MetricsService } from './metrics.service';

export interface WorkerProbeOptions {
  host: string;
  port: number;
  bearerToken?: string;
  isReady: () => boolean;
}

export class WorkerProbeServer {
  private server?: Server;

  constructor(
    private readonly metrics: MetricsService,
    private readonly options: WorkerProbeOptions,
  ) {}

  async start(): Promise<void> {
    if (this.server) return;
    const server = createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'GET') {
        response.writeHead(405, { Allow: 'GET' }).end();
        return;
      }
      if (request.url === '/health/live') {
        this.json(response, 200, { status: 'ok', service: 'sigvits-export-worker' });
        return;
      }
      if (request.url === '/health/ready') {
        const ready = this.options.isReady();
        this.json(response, ready ? 200 : 503, {
          status: ready ? 'ready' : 'not_ready',
          service: 'sigvits-export-worker',
        });
        return;
      }
      if (request.url === '/metrics') {
        if (!this.authorized(request.headers.authorization)) {
          this.json(response, 401, { status: 'unauthorized' });
          return;
        }
        response.writeHead(200, {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        });
        response.end(this.metrics.render());
        return;
      }
      this.json(response, 404, { status: 'not_found' });
    });
    server.requestTimeout = 5_000;
    server.headersTimeout = 6_000;
    server.keepAliveTimeout = 5_000;
    server.maxRequestsPerSocket = 100;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.options.port, this.options.host, () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.server = server;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  private authorized(header: string | undefined): boolean {
    const expected = this.options.bearerToken?.trim();
    if (!expected) return true;
    if (!header?.startsWith('Bearer ')) return false;
    const actualBuffer = Buffer.from(header.slice(7), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return (
      actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  private json(
    response: import('node:http').ServerResponse,
    statusCode: number,
    body: Readonly<Record<string, string>>,
  ): void {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
  }
}
