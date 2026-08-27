import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import { ROLE_PROFILES } from '../../core/role-data';
import { RoleDashboard } from './role-dashboard';

describe('RoleDashboard', () => {
  const getTerritorialAnalytics = vi.fn();

  beforeEach(async () => {
    getTerritorialAnalytics.mockReturnValue(
      of({
        level: 'REGION',
        year: 2026,
        month: 8,
        rows: [
          {
            id: 'region-1',
            code: '05',
            name: 'Cortés',
            status: 'APROBADO_CENTRAL',
            attentions: 40,
            newCases: 30,
            controls: 10,
            alerts: 2,
          },
          {
            id: 'region-2',
            code: '01',
            name: 'Atlántida',
            status: 'SIN_REPORTE',
            attentions: 0,
            newCases: 0,
            controls: 0,
            alerts: 0,
          },
        ],
      }),
    );
    await TestBed.configureTestingModule({
      imports: [RoleDashboard],
      providers: [
        { provide: AuthService, useValue: { isDemo: signal(false) } },
        { provide: ItsCaptureApiService, useValue: { getTerritorialAnalytics } },
      ],
    }).compileComponents();
  });

  it('calcula métricas y prioridades desde la analítica autorizada', async () => {
    const fixture = TestBed.createComponent(RoleDashboard);
    fixture.componentRef.setInput(
      'role',
      ROLE_PROFILES.find((role) => role.id === 'superadmin')!,
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(getTerritorialAnalytics).toHaveBeenCalledWith(
      'REGION',
      expect.any(Number),
      expect.any(Number),
    );
    expect(element.textContent).toContain('Territorios visibles');
    expect(element.textContent).toContain('Atenciones reportadas');
    expect(element.textContent).toContain('40');
    expect(element.textContent).toContain('1 territorio sin reporte vigente');
    expect(element.textContent).toContain('Atlántida');
  });
});
