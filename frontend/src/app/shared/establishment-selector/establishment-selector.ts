import { Component, inject, input, output } from '@angular/core';
import { EstablishmentContext } from '../../core/establishment-context';

@Component({
  selector: 'app-establishment-selector',
  templateUrl: './establishment-selector.html',
  styleUrl: './establishment-selector.css',
})
export class EstablishmentSelector {
  readonly readOnlyView = input(false);
  readonly selected = output<void>();
  protected readonly context = inject(EstablishmentContext);

  changeEstablishment(event: Event) {
    this.context.select((event.target as HTMLSelectElement).value);
    this.selected.emit();
  }
}
