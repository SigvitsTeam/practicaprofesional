import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ItsCaptureApiService } from '../../core/its-capture-api.service';
import { OperationalPeriodService } from '../../core/operational-period';
import { RoleContext } from '../../core/role-context';
import { TerritorialApiService } from '../../core/territorial-api.service';
import { Networks } from './networks';

describe('Networks accessibility', () => {
  let fixture: ComponentFixture<Networks>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Networks],
      providers: [
        {
          provide: TerritorialApiService,
          useValue: { listNetworkAudit: () => of({ items: [] }) },
        },
        { provide: ItsCaptureApiService, useValue: {} },
        { provide: RoleContext, useValue: { activeRoleId: () => 'regional-admin' } },
        {
          provide: OperationalPeriodService,
          useValue: { selectedEndKey: signal(''), selected: signal(undefined) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Networks);
    element = fixture.nativeElement as HTMLElement;
    Object.assign(fixture.componentInstance, {
      networks: [
        {
          id: 'network-1',
          regionId: 'region-1',
          regionName: 'Cortés',
          code: 'R1',
          name: 'Red uno',
          municipalities: 0,
          reports: '—',
          total: 0,
          status: 'Activa',
          rawStatus: 'ACTIVO',
          active: true,
          configured: true,
          memberIds: [],
          updatedAt: '2026-08-27T12:00:00.000Z',
        },
      ],
    });
    fixture.componentInstance.selectNetwork('network-1');
    fixture.detectChanges();
  });

  function getTab(id: string) {
    const tab = element.querySelector<HTMLButtonElement>(`#network-tab-${id}`);
    if (!tab) throw new Error(`Missing network tab: ${id}`);
    return tab;
  }

  function expectActiveTab(id: string) {
    const activeTab = getTab(id);
    const tabs = Array.from(element.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([activeTab]);
    expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')).toEqual([activeTab]);
    const visiblePanels = Array.from(
      element.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
    ).filter((panel) => !panel.hidden);
    expect(visiblePanels.map((panel) => panel.id)).toEqual([`network-panel-${id}`]);
  }

  it('connects every tab to its labelled panel and exposes only the active panel', () => {
    const tabs = element.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs.length).toBe(4);
    for (const tab of tabs) {
      const panel = element.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`);
      expect(panel?.getAttribute('role')).toBe('tabpanel');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
      expect(panel?.tabIndex).toBe(0);
    }
    expectActiveTab('summary');
  });

  it('moves focus and selection with arrows, wraps at both ends, and supports Home/End', () => {
    let currentTab = getTab('summary');
    currentTab.focus();
    const steps = [
      ['ArrowRight', 'municipalities'],
      ['End', 'history'],
      ['ArrowRight', 'summary'],
      ['ArrowLeft', 'history'],
      ['Home', 'summary'],
    ];
    for (const [key, nextId] of steps) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      currentTab.dispatchEvent(event);
      fixture.detectChanges();
      currentTab = getTab(nextId);
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(currentTab);
      expectActiveTab(nextId);
    }
  });

  it('keeps selection and roving tabindex synchronized after clicking a tab', () => {
    getTab('consolidated').click();
    fixture.detectChanges();
    expectActiveTab('consolidated');
  });

  it('does not capture scrolling keys or modified browser shortcuts', () => {
    const tab = getTab('summary');
    for (const options of [{ key: 'ArrowDown' }, { key: 'ArrowRight', altKey: true }]) {
      const event = new KeyboardEvent('keydown', { ...options, bubbles: true, cancelable: true });
      tab.dispatchEvent(event);
      fixture.detectChanges();
      expect(event.defaultPrevented).toBe(false);
      expectActiveTab('summary');
    }
  });

  it('provides descriptive captions and column scope for both network tables', () => {
    const tables = element.querySelectorAll('table');
    expect(tables.length).toBe(2);
    for (const table of tables) {
      expect(table.caption?.textContent).toContain('Red uno');
      for (const header of table.querySelectorAll('thead th')) {
        expect(header.getAttribute('scope')).toBe('col');
      }
    }
  });
});
