import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the institutional dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Resumen epidemiológico');
    expect(compiled.querySelector('.brand strong')?.textContent).toContain('SIGVITS');
  });

  it('should toggle and persist dark mode', () => {
    localStorage.setItem('sigvits-theme', 'light');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.toggleTheme();

    expect(app.darkMode).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('sigvits-theme')).toBe('dark');
  });

  it('should render the coordination digitizer ITS 1 workflow without legacy coverage fields', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.navigate('Captura ITS 1');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-establishment-selector option')).toHaveLength(12);
    expect(compiled.textContent).toContain('Digitadora de coordinación');
    expect(compiled.textContent).toContain('Contacto');
    expect(compiled.textContent).toContain('Embarazada');
    expect(compiled.textContent).not.toContain('¿Pertenece al AGI?');
  });

  it('should render one interactive map with twelve establishment markers', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.navigate('Mapas');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-interactive-map')).toHaveLength(1);
    expect(compiled.querySelectorAll('.marker')).toHaveLength(12);
    expect(compiled.textContent).toContain('Métrica activa');
  });
});
