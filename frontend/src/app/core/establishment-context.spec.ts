import { EstablishmentContext } from './establishment-context';

describe('EstablishmentContext', () => {
  it('invalidates the selected establishment when the same code receives a real identifier', () => {
    const context = new EstablishmentContext();
    expect(context.selected().code).toBe('2721');
    expect(context.selected().id).toBeUndefined();
    context.replace([
      { id: 'authorized-facility', code: '2721', name: 'Centro real', type: 'CIS' },
    ]);
    expect(context.selected().id).toBe('authorized-facility');
    expect(context.selected().name).toBe('Centro real');
  });

  it('does not retain a previously authorized facility when the catalog is empty', () => {
    const context = new EstablishmentContext();
    context.replace([{ id: 'previous-facility', code: '2721', name: 'Anterior', type: 'CIS' }]);
    expect(context.selected().id).toBe('previous-facility');
    context.replace([]);
    expect(context.establishments).toEqual([]);
    expect(context.selected().id).toBeUndefined();
    expect(context.selectedCode()).toBe('');
  });

  it('selects only facilities in the refreshed authorized catalog', () => {
    const context = new EstablishmentContext();
    context.replace([{ id: 'new-facility', code: 'NEW', name: 'Nuevo', type: 'CIS' }]);
    context.select('2721');
    expect(context.selected().id).toBe('new-facility');
    expect(context.selectedCode()).toBe('NEW');
  });
});
