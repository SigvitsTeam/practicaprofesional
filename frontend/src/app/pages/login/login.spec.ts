import { TestBed } from '@angular/core/testing';
import { Login } from './login';

describe('Login', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [Login] }).compileComponents();
  });

  it('renders the institutional access form', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toContain('Bienvenido');
    expect(element.querySelector('input[type="email"]')).toBeTruthy();
    expect(element.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('shows validation messages for an empty submission', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.submit-button')!
      .click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Ingresa un correo válido',
    );
  });

  it('signs in with the explicit demo account', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.demo-access button')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    fixture.detectChanges();
    expect(sessionStorage.getItem('sigvits-auth-session')).toContain('demo-municipal-coordinator');
  });
});
