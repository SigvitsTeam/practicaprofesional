import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmailAccessService } from '../../core/email-access.service';
import { PasswordSetup } from './password-setup';

describe('Password setup view', () => {
  const access = {
    action: signal('recovery'),
    status: signal('ready'),
    error: signal(''),
    email: signal('qa@example.invalid'),
    setPassword: vi.fn(),
  };
  beforeEach(async () => {
    access.action.set('recovery');
    access.status.set('ready');
    access.error.set('');
    access.setPassword.mockReset().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [PasswordSetup],
      providers: [{ provide: EmailAccessService, useValue: access }],
    }).compileComponents();
  });
  it('renders password confirmation with new-password autofill', () => {
    const fixture = TestBed.createComponent(PasswordSetup);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('input[autocomplete="new-password"]')).toHaveLength(2);
    expect(host.textContent).toContain('12 caracteres');
  });
  it('clears password controls after a confirmed update', async () => {
    const fixture = TestBed.createComponent(PasswordSetup);
    fixture.componentInstance.form.setValue({
      password: 'frase de QA bastante larga',
      confirmation: 'frase de QA bastante larga',
    });
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      password: '',
      confirmation: '',
    });
  });
  it('does not show password fields for an invalid link', () => {
    access.status.set('error');
    access.error.set('Enlace vencido');
    const fixture = TestBed.createComponent(PasswordSetup);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Enlace vencido',
    );
  });
  it('keeps the user on the form while saving', () => {
    access.status.set('saving');
    const fixture = TestBed.createComponent(PasswordSetup);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.back-button').disabled).toBe(true);
  });
});
