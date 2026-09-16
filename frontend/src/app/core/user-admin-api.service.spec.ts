import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RuntimeConfigService } from './runtime-config.service';
import { UserAdminApiService } from './user-admin-api.service';

describe('UserAdminApiService invitation contract', () => {
  let http: HttpTestingController;
  let service: UserAdminApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RuntimeConfigService, useValue: { apiUrl: '/api' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(UserAdminApiService);
  });

  afterEach(() => http.verify());

  it('sends a new invitation with POST and preserves the request body', () => {
    const input = {
      activate: true,
      expectedUpdatedAt: '2026-09-16T16:40:00.000Z',
      reason: 'Alta de usuario para pruebas',
    };

    service.invite('qa-user-id', input).subscribe();

    const request = http.expectOne('/api/v1/admin/users/qa-user-id/invitation');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({});
  });

  it('reads invitation status from the dedicated GET endpoint', () => {
    service.getInvitationStatus('qa-user-id').subscribe();

    const request = http.expectOne('/api/v1/admin/users/qa-user-id/invitation-status');
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush({
      status: 'PENDING',
      sentAt: '2026-09-16T16:40:00.000Z',
      emailConfirmedAt: null,
      lastAccessAt: null,
    });
  });

  it('resends an invitation with POST and preserves the request body', () => {
    const input = {
      expectedUpdatedAt: '2026-09-16T16:40:00.000Z',
      reason: 'Reenvío solicitado por soporte',
    };

    service.resendInvitation('qa-user-id', input).subscribe();

    const request = http.expectOne('/api/v1/admin/users/qa-user-id/invitation/resend');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({
      status: 'PENDING',
      sentAt: '2026-09-16T16:45:00.000Z',
      emailConfirmedAt: null,
      lastAccessAt: null,
    });
  });
});
