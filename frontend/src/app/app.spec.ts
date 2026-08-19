import {
  ComponentFixture,
  DeferBlockBehavior,
  DeferBlockState,
  TestBed,
} from '@angular/core/testing';
import { App } from './app';
import { environment } from '../environments/environment';

const TEST_SESSION = 'sigvits-auth-session';
const settleDeferred = async (fixture: ComponentFixture<App>) => {
  fixture.detectChanges();
  const blocks = await fixture.getDeferBlocks();
  await Promise.all(blocks.map(block => block.render(DeferBlockState.Complete)));
  await fixture.whenStable();
  fixture.detectChanges();
};

describe('App', () => {
  beforeEach(async () => {
    localStorage.setItem(TEST_SESSION, JSON.stringify({
      provider: 'demo', remember: true,
      user: { id: 'test', email: environment.auth.demoEmail, name: 'Test' },
    }));
    await TestBed.configureTestingModule({
      imports: [App],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.removeItem(TEST_SESSION);
    sessionStorage.removeItem(TEST_SESSION);
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

  afterEach(() => {
    localStorage.removeItem(TEST_SESSION);
    sessionStorage.removeItem(TEST_SESSION);
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

  it('should render the coordination digitizer ITS 1 workflow without legacy coverage fields', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('coordination-digitizer');
    fixture.componentInstance.navigate('Captura ITS 1');
    fixture.detectChanges();
    await settleDeferred(fixture);
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

  it('should keep the establishment manager fixed to its assigned establishment', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('establishment-manager');
    fixture.componentInstance.navigate('Captura ITS 1');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-establishment-selector')).toHaveLength(0);
    expect(compiled.textContent).toContain('CIS Linda Coello');
    expect(compiled.textContent).toContain('85481');
    expect(compiled.textContent).toContain('Responsable de Establecimiento');
  });

  it('should not fabricate territorial details when the catalog is unavailable', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Administración');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No hay municipios disponibles dentro del alcance autorizado.');
    expect(compiled.textContent).not.toContain('Puerto Cortés');
    expect(compiled.querySelectorAll('.history-timeline article')).toHaveLength(0);
  });

  it('should let only the global superadmin manage regions, municipalities and establishments', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('superadmin');
    fixture.componentInstance.navigate('Administración');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.global-territory-management')).toBeTruthy();
    expect(compiled.textContent).toContain('Nueva región');
    expect(compiled.textContent).toContain('Nuevo municipio');
    expect(compiled.querySelector('.page-heading .primary')?.textContent).toContain('Nueva región');
    expect(compiled.querySelector<HTMLElement>('.global-filter-slot')?.hidden).toBe(true);
    expect(compiled.querySelectorAll('.global-territory-table')).toHaveLength(2);
    expect(compiled.querySelector('.municipality-catalog')).toBeTruthy();
    expect(compiled.querySelector('.facility-admin')).toBeTruthy();
    expect(compiled.textContent).toContain('Catálogo de establecimientos');
    expect(compiled.textContent).toContain('Estados operativos controlados');

    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Administración');
    fixture.detectChanges();
    expect(compiled.querySelector('.global-territory-management')).toBeNull();
    expect(compiled.querySelector('.facility-admin')).toBeTruthy();
  });

  it('should let global and regional superadmins manage health networks', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('superadmin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.network-catalog')).toBeTruthy();
    expect(compiled.textContent).toContain('＋ Nueva Red');
    expect(compiled.textContent).toContain('Producción consolidada');
    expect(compiled.textContent).toContain('Pendiente API analítica');
    expect(Array.from(compiled.querySelectorAll('.network-filterbar label')).some(label => label.querySelector('span')?.textContent?.trim() === 'Región')).toBe(true);

    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.textContent).toContain('Redes de la Región de Cortés');
    expect(compiled.textContent).toContain('＋ Nueva Red');
  });

  it('should give the regional admin a read-only network view with filters and exports', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-admin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.scope-toggle')!.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('SOLO CONSULTA');
    expect(compiled.querySelector('h1')?.textContent).toContain('Consolidado por Redes');
    expect(compiled.textContent).not.toContain('＋ Nueva Red');
    expect(compiled.textContent).toContain('↓ Excel');
    expect(compiled.textContent).toContain('↓ PDF');
    expect(Array.from(compiled.querySelectorAll('.filters label')).some(label => label.querySelector('span')?.textContent?.trim() === 'Red')).toBe(true);

    expect(compiled.querySelector('.network-catalog')).toBeTruthy();
    expect(compiled.textContent).toContain('catálogo y la composición municipal provienen de PostgreSQL');
  });

  it('should show the aggregated network consolidation without individual ITS 1 data', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-superadmin');
    fixture.componentInstance.navigate('Redes');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Pendiente API analítica');
    expect(compiled.textContent).not.toContain('Número de expediente');
  });

  it('should render one interactive map with twelve establishment markers', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.navigate('Mapas');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-interactive-map')).toHaveLength(1);
    expect(compiled.querySelectorAll('.marker')).toHaveLength(12);
    expect(compiled.textContent).toContain('Métrica activa');
  });

  it('should configure annual evaluations with comparison dimensions and two time ranges', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('regional-admin');
    fixture.componentInstance.navigate('Reportes y exportaciones');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;

    const annualButton = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.export-catalog button'))
      .find(button => button.textContent?.includes('Evaluación anual'))!;
    annualButton.click();
    fixture.detectChanges();

    expect(compiled.querySelector('.annual-dialog')).toBeTruthy();
    expect(compiled.querySelectorAll('.dimension-options button')).toHaveLength(3);
    expect(compiled.querySelectorAll('input[type="month"]')).toHaveLength(4);
    expect(compiled.textContent).toContain('Región de Cortés');
    expect(compiled.textContent).toContain('Solo se muestran territorios y datos agregados permitidos');

    compiled.querySelector<HTMLButtonElement>('.annual-dialog button[type="submit"]')!.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.annual-dialog')).toBeNull();
    expect(compiled.querySelector('.annual-preview')).toBeTruthy();
    expect(compiled.textContent).toContain('ene 2025 – dic 2025');
  });

  it('should prevent an establishment user from comparing unauthorized territories', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.changeRole('establishment-manager');
    fixture.componentInstance.navigate('Reportes y exportaciones');
    fixture.detectChanges();
    await settleDeferred(fixture);
    const compiled = fixture.nativeElement as HTMLElement;

    Array.from(compiled.querySelectorAll<HTMLButtonElement>('.export-catalog button'))
      .find(button => button.textContent?.includes('Evaluación anual'))!.click();
    fixture.detectChanges();

    const territoryDimension = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.dimension-options button'))
      .find(button => button.textContent?.includes('Territorios'))!;
    expect(territoryDimension.disabled).toBe(true);
    expect(territoryDimension.textContent).toContain('No disponible para su alcance');
  });

  it('should provide hierarchical global filters according to each role level', () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;
    const filter = (label: string) => Array.from(compiled.querySelectorAll<HTMLLabelElement>('.filters label'))
      .find(item => item.querySelector('span')?.textContent?.trim() === label)?.querySelector('select');

    fixture.componentInstance.changeRole('superadmin');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.scope-toggle')!.click();
    fixture.detectChanges();
    expect(filter('Región')?.value).toBe('Todas las regiones');
    expect(filter('Red')?.options).toHaveLength(1);
    expect(filter('Municipio')?.value).toBe('Todos los municipios');

    fixture.componentInstance.changeRole('regional-admin');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.scope-toggle')!.click();
    fixture.detectChanges();
    expect(filter('Región')?.value).toBe('Región de Cortés');
    expect(filter('Región')?.disabled).toBe(true);
    expect(filter('Red')?.options).toHaveLength(2);

    fixture.componentInstance.changeRole('municipal-coordinator');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.scope-toggle')!.click();
    fixture.detectChanges();
    expect(filter('Región')).toBeUndefined();
    expect(filter('Municipio')?.value).toBe('Puerto Cortés');
    expect(filter('Municipio')?.disabled).toBe(true);
    expect(filter('Establecimiento')?.options).toHaveLength(13);

    fixture.componentInstance.changeRole('establishment-manager');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.scope-toggle')!.click();
    fixture.detectChanges();
    expect(filter('Municipio')).toBeUndefined();
    expect(filter('Establecimiento')?.value).toBe('CIS Linda Coello');
    expect(filter('Establecimiento')?.disabled).toBe(true);
  });

  it('should provide valid start and end ranges for periods and epidemiological weeks', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const select = (label: string) => compiled.querySelector<HTMLSelectElement>(`.filters select[aria-label="${label}"]`)!;

    expect(select('Período inicial').value).toBe('Julio 2026');
    expect(select('Período final').value).toBe('Julio 2026');
    expect(select('Período final').options).toHaveLength(1);
    expect(select('Semana inicial').value).toBe('SE 27');
    expect(select('Semana final').value).toBe('SE 29');
    expect(select('Semana final').options).toHaveLength(3);

    select('Semana inicial').value = 'SE 29';
    select('Semana inicial').dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(select('Semana final').value).toBe('SE 29');
    expect(select('Semana final').options).toHaveLength(1);
  });

  it('should show global filters only on aggregated and analytical views', () => {
    const expectFilters = (page: string, visible: boolean) => {
      const pageFixture = TestBed.createComponent(App);
      pageFixture.componentInstance.navigate(page);
      pageFixture.detectChanges();
      const pageElement = pageFixture.nativeElement as HTMLElement;
      expect(pageFixture.componentInstance.active).toBe(page);
      expect(pageElement.querySelector<HTMLElement>('.global-filter-slot')?.hidden).toBe(!visible);
      pageFixture.destroy();
    };

    expectFilters('Inicio', true);
    expectFilters('Bandeja de revisión', true);
    expectFilters('Consolidados', true);
    expectFilters('Mapas', true);
    expectFilters('Redes', true);
    expectFilters('Reportes y exportaciones', true);
    expectFilters('Captura ITS 1', false);
    expectFilters('Reporte ITS 2', false);
    expectFilters('Administración', false);
  });

  it('should adapt review entities and totals to each approval level', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.changeRole('central-validator');
    fixture.componentInstance.navigate('Bandeja de revisión');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.querySelector('h1')?.textContent).toContain('Revisión de regiones');
    expect(compiled.querySelector('app-report-table th')?.textContent).toContain('Región sanitaria');
    expect(compiled.textContent).toContain('Región Sanitaria de Cortés');

    fixture.componentInstance.changeRole('regional-admin');
    fixture.componentInstance.navigate('Bandeja de revisión');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.querySelector('h1')?.textContent).toContain('Revisión de municipios');
    expect(compiled.querySelector('app-report-table th')?.textContent).toContain('Municipio');
    expect(compiled.textContent).toContain('Puerto Cortés');
  });

  it('should adapt consolidation coverage and workflow to the active level', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.changeRole('central-validator');
    fixture.componentInstance.navigate('Consolidados');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.textContent).toContain('1 de 18 regiones');
    expect(compiled.textContent).toContain('Publicación nacional');

    fixture.componentInstance.changeRole('regional-admin');
    fixture.componentInstance.navigate('Consolidados');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.textContent).toContain('2 de 12 municipios');
    expect(compiled.textContent).toContain('Envío a Nivel Central');
  });

  it('should start maps at the authorized geographic level', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.changeRole('central-validator');
    fixture.componentInstance.navigate('Mapas');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.querySelector('h1')?.textContent).toContain('Mapa nacional');
    expect(compiled.textContent).toContain('Regiones sanitarias visibles');
    expect(compiled.textContent).toContain('Honduras · información agregada por región');

    fixture.componentInstance.changeRole('establishment-manager');
    fixture.componentInstance.navigate('Mapas');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.querySelectorAll('.marker')).toHaveLength(1);
    expect(compiled.textContent).not.toContain('← Región de Cortés');
  });

  it('should expose only role-appropriate exports and authors', async () => {
    const fixture = TestBed.createComponent(App);
    const compiled = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.changeRole('central-validator');
    fixture.componentInstance.navigate('Reportes y exportaciones');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.textContent).toContain('Consolidado nacional');
    expect(compiled.textContent).toContain('Dra. Elena Pineda');

    fixture.componentInstance.changeRole('establishment-manager');
    fixture.componentInstance.navigate('Reportes y exportaciones');
    fixture.detectChanges();
    await settleDeferred(fixture);
    expect(compiled.textContent).toContain('ITS 1 del establecimiento');
    expect(compiled.textContent).toContain('CIS Linda Coello');
    expect(compiled.textContent).not.toContain('Consolidado nacional');
  });
});
