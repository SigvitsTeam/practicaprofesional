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
    fixture.componentInstance.changeRole('coordination-digitizer');
    fixture.componentInstance.navigate('Captura ITS 1');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-establishment-selector option')).toHaveLength(12);
    expect(compiled.textContent).toContain('Digitadora de Coordinación');
    expect(compiled.textContent).toContain('Contacto');
    expect(compiled.textContent).toContain('Embarazada');
    expect(compiled.textContent).not.toContain('¿Pertenece al AGI?');
  });

  it('should expose the eight approved user views without the removed establishment digitizer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const options = compiled.querySelectorAll<HTMLSelectElement>('.role-switcher option');

    expect(options).toHaveLength(8);
    expect(Array.from(options).map(option => option.textContent)).not.toContain('Digitador de Establecimiento');
  });

  it('should render the regional superadmin with regional administration limits', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Gestión integral de la región');
    expect(compiled.textContent).toContain('SuperAdmin Regional');
    expect(compiled.textContent).toContain('No administra otras regiones');
    expect(Array.from(compiled.querySelectorAll('.nav-item')).some(item => item.textContent?.includes('Administración'))).toBe(true);
  });

  it('should keep the establishment manager fixed to its assigned establishment', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('establishment-manager');
    fixture.componentInstance.navigate('Captura ITS 1');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-establishment-selector')).toHaveLength(0);
    expect(compiled.textContent).toContain('CIS Linda Coello');
    expect(compiled.textContent).toContain('85481');
    expect(compiled.textContent).toContain('Responsable de Establecimiento');
  });

  it('should display geography, responsibles and history territory tabs', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Administración');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const tab = (label: string) => Array.from(compiled.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.trim() === label)!;

    tab('Geografía').click();
    fixture.detectChanges();
    expect(compiled.querySelector('.geography-view')).toBeTruthy();
    expect(compiled.textContent).toContain('11 de 12');

    tab('Responsables').click();
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.responsible-list article')).toHaveLength(3);

    tab('Historial').click();
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.history-timeline article')).toHaveLength(4);
  });

  it('should let only the global superadmin manage regions and municipalities', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('superadmin');
    fixture.componentInstance.navigate('Administración');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.global-territory-management')).toBeTruthy();
    expect(compiled.textContent).toContain('Nueva región');
    expect(compiled.textContent).toContain('Nuevo municipio');
    expect(compiled.querySelector('.page-heading .primary')?.textContent).toContain('Nueva región');
    const scopeFilter = Array.from(compiled.querySelectorAll('.filters label')).find(label => label.querySelector('span')?.textContent?.trim() === 'Alcance');
    expect(scopeFilter?.querySelector('select')?.value).toBe('Honduras');
    expect(compiled.querySelectorAll('.global-territory-table')).toHaveLength(2);
    expect(compiled.querySelectorAll('.municipality-catalog tbody tr')).toHaveLength(3);

    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Administración');
    fixture.detectChanges();
    expect(compiled.querySelector('.global-territory-management')).toBeNull();
  });

  it('should let global and regional superadmins manage health networks', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('superadmin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('.network-catalog > button')).toHaveLength(5);
    expect(compiled.textContent).toContain('Red Puerto Cortés–Omoa');
    expect(compiled.textContent).toContain('＋ Nueva Red');
    expect(compiled.textContent).toContain('Producción consolidada');
    expect(compiled.textContent).toContain('280');
    expect(Array.from(compiled.querySelectorAll('.network-filterbar label')).some(label => label.querySelector('span')?.textContent?.trim() === 'Región')).toBe(true);

    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Redes de la Región de Cortés');
    expect(compiled.textContent).toContain('＋ Nueva Red');
  });

  it('should give the regional admin a read-only network view with filters and exports', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-admin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('SOLO CONSULTA');
    expect(compiled.querySelector('h1')?.textContent).toContain('Consolidado por Redes');
    expect(compiled.textContent).not.toContain('＋ Nueva Red');
    expect(compiled.textContent).toContain('↓ Excel');
    expect(compiled.textContent).toContain('↓ PDF');
    expect(Array.from(compiled.querySelectorAll('.filters label')).some(label => label.querySelector('span')?.textContent?.trim() === 'Red')).toBe(true);

    const municipalitiesTab = Array.from(compiled.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.trim() === 'Municipios asociados')!;
    municipalitiesTab.click();
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.network-members input:disabled')).toHaveLength(5);
  });

  it('should show the aggregated network consolidation without individual ITS 1 data', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const consolidatedTab = Array.from(compiled.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.trim() === 'Consolidado')!;

    consolidatedTab.click();
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.network-consolidated tbody tr')).toHaveLength(5);
    expect(compiled.textContent).toContain('Puerto Cortés');
    expect(compiled.textContent).toContain('Omoa');
    expect(compiled.textContent).toContain('no contiene registros individuales');
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
