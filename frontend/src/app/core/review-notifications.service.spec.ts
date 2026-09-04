import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { ItsCaptureApiService, type Its2WorkflowReport } from './its-capture-api.service';
import { OperationalPeriodService } from './operational-period';
import { ReviewNotificationsService } from './review-notifications.service';
import { RoleContext } from './role-context';

describe('ReviewNotificationsService', () => {
  it('counts only reports that currently require municipal review', () => {
    const inbox = new Subject<Its2WorkflowReport[]>();
    const getMunicipalIts2Inbox = vi.fn(() => inbox);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: 'user-1' }),
            isDemo: signal(false),
          },
        },
        {
          provide: RoleContext,
          useValue: { activeRoleId: signal('municipal-coordinator') },
        },
        {
          provide: OperationalPeriodService,
          useValue: {
            selectedEndKey: signal('2026-09'),
            selected: signal({ year: 2026, month: 9 }),
          },
        },
        {
          provide: ItsCaptureApiService,
          useValue: { getMunicipalIts2Inbox },
        },
      ],
    });

    const service = TestBed.inject(ReviewNotificationsService);
    TestBed.flushEffects();
    expect(getMunicipalIts2Inbox).toHaveBeenCalledWith(2026, 9);

    inbox.next([
      { status: 'ENVIADO_A_MUNICIPIO' },
      { status: 'APROBADO_MUNICIPIO' },
      { status: 'ENVIADO_A_MUNICIPIO' },
    ] as Its2WorkflowReport[]);

    expect(service.count()).toBe(2);
  });
});
