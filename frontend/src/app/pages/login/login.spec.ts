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
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Bienvenido');
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('shows validation messages for an empty submission', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    (compiledButton(fixture.nativeElement) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ingresa un correo válido');
  });

  it('signs in with the explicit demo account', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const demo = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.demo-access button')!;
    demo.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    fixture.detectChanges();
    expect(sessionStorage.getItem('sigvits-auth-session')).toContain('demo-municipal-coordinator');
  });
});

function compiledButton(element: HTMLElement): Element | null {
  return element.querySelector('.submit-button');
}
