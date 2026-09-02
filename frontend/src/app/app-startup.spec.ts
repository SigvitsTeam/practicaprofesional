import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { App } from './app';
import { AuthService } from './core/auth.service';
import {
  CurrentProfileApiService,
  type CurrentInstitutionalProfile,
} from './core/current-profile-api.service';
import {
  ItsCaptureApiService,
  type MonthlyReportingPeriodResponse,
} from './core/its-capture-api.service';
import { OperationalPeriodService } from './core/operational-period';

const profile: CurrentInstitutionalProfile = {
  userId: 'qa-user',
  displayName: 'QA',
  roles: ['COORDINADOR_MUNICIPAL'],
  permissions: [],
  territory: { national: false, regionIds: [], municipalityIds: [], facilityIds: [] },
};
const catalog: MonthlyReportingPeriodResponse[] = [
  {
    id: 'qa-period',
    year: 2026,
    month: 9,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'ABIERTO',
  },
];

describe('Parallel institutional startup', () => {
  let profiles: Subject<CurrentInstitutionalProfile>;
  let periods: Subject<MonthlyReportingPeriodResponse[]>;

  beforeEach(async () => {
    sessionStorage.removeItem('sigvits-auth-session');
    localStorage.setItem(
      'sigvits-auth-session',
      JSON.stringify({
        provider: 'supabase',
        remember: true,
        accessToken: 'qa-token',
        expiresAt: Date.now() + 3_600_000,
        user: { id: 'qa-user', email: 'qa@example.invalid', name: 'QA' },
      }),
    );
    profiles = new Subject();
    periods = new Subject();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: CurrentProfileApiService, useValue: { get: () => profiles } }],
    }).compileComponents();
    vi.spyOn(TestBed.inject(ItsCaptureApiService), 'getMonthlyReportingPeriods').mockReturnValue(
      periods,
    );
  });

  afterEach(() => {
    localStorage.removeItem('sigvits-auth-session');
    sessionStorage.removeItem('sigvits-auth-session');
  });

  it.each(['profile', 'periods'])(
    'starts both requests together and waits for both when %s finishes first',
    (first) => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      expect(profiles.observed).toBe(true);
      expect(periods.observed).toBe(true);
      const finishProfile = () => {
        profiles.next(profile);
        profiles.complete();
      };
      const finishPeriods = () => {
        periods.next(catalog);
        periods.complete();
      };
      (first === 'profile' ? finishProfile : finishPeriods)();
      expect(fixture.componentInstance.profileReady()).toBe(false);
      expect(TestBed.inject(OperationalPeriodService).periods()).toEqual([]);
      (first === 'profile' ? finishPeriods : finishProfile)();
      expect(fixture.componentInstance.profileReady()).toBe(true);
      expect(TestBed.inject(OperationalPeriodService).selected()?.id).toBe('qa-period');
    },
  );

  it('cancels periods on a profile error without publishing partial state', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    profiles.error(new Error('network'));
    expect(periods.observed).toBe(false);
    expect(fixture.componentInstance.profileReady()).toBe(false);
    expect(fixture.componentInstance.profileError()).toContain('perfil institucional');
    expect(TestBed.inject(OperationalPeriodService).periods()).toEqual([]);
  });

  it('cancels profile resolution if periods fail', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    periods.error(new Error('network'));
    expect(profiles.observed).toBe(false);
    expect(fixture.componentInstance.profileReady()).toBe(false);
    expect(fixture.componentInstance.profileError()).toContain('períodos institucionales');
  });

  it('rejects a profile with no valid role even if periods have loaded', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    periods.next(catalog);
    periods.complete();
    profiles.next({ ...profile, roles: ['UNKNOWN'] });
    expect(fixture.componentInstance.profileReady()).toBe(false);
    expect(fixture.componentInstance.profileError()).toContain('rol institucional vigente');
    expect(TestBed.inject(OperationalPeriodService).periods()).toEqual([]);
  });

  it('cancels both in-flight requests when signing out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(AuthService).signOut();
    fixture.detectChanges();
    expect(profiles.observed).toBe(false);
    expect(periods.observed).toBe(false);
    profiles.next(profile);
    periods.next(catalog);
    expect(fixture.componentInstance.profileReady()).toBe(false);
    expect(TestBed.inject(OperationalPeriodService).periods()).toEqual([]);
  });

  it('clears a completed catalog when signing out', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    profiles.next(profile);
    profiles.complete();
    periods.next(catalog);
    periods.complete();
    expect(fixture.componentInstance.profileReady()).toBe(true);
    TestBed.inject(AuthService).signOut();
    fixture.detectChanges();
    const service = TestBed.inject(OperationalPeriodService);
    expect(service.periods()).toEqual([]);
    expect(service.selectedStartKey()).toBe('');
    expect(service.selectedEndKey()).toBe('');
    expect(fixture.componentInstance.profileReady()).toBe(false);
  });

  it('cancels requests when the application is destroyed', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.destroy();
    expect(profiles.observed).toBe(false);
    expect(periods.observed).toBe(false);
  });

  it('discards an intervening session even when switching back to the original user', () => {
    const original = { id: 'qa-user', email: 'qa@example.invalid', name: 'QA' };
    const user = signal(original);
    vi.spyOn(TestBed.inject(AuthService), 'user').mockImplementation(user);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    profiles.next(profile);
    profiles.complete();
    periods.next(catalog);
    periods.complete();
    expect(fixture.componentInstance.profileReady()).toBe(true);

    const intermediateProfiles = new Subject<CurrentInstitutionalProfile>();
    const intermediatePeriods = new Subject<MonthlyReportingPeriodResponse[]>();
    const getProfile = vi.spyOn(TestBed.inject(CurrentProfileApiService), 'get');
    getProfile.mockReturnValue(intermediateProfiles);
    vi.mocked(TestBed.inject(ItsCaptureApiService).getMonthlyReportingPeriods).mockReturnValue(
      intermediatePeriods,
    );
    user.set({ ...original, id: 'other-user' });
    fixture.detectChanges();
    expect(fixture.componentInstance.profileReady()).toBe(false);
    expect(intermediateProfiles.observed).toBe(true);

    profiles = new Subject();
    periods = new Subject();
    getProfile.mockReturnValue(profiles);
    vi.mocked(TestBed.inject(ItsCaptureApiService).getMonthlyReportingPeriods).mockReturnValue(
      periods,
    );
    user.set(original);
    fixture.detectChanges();
    expect(intermediateProfiles.observed).toBe(false);
    expect(intermediatePeriods.observed).toBe(false);
    expect(profiles.observed).toBe(true);
    profiles.next(profile);
    profiles.complete();
    periods.next(catalog);
    periods.complete();
    expect(fixture.componentInstance.profileReady()).toBe(true);
  });
});
