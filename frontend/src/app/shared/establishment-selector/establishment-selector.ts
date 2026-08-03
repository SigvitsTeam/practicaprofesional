import { Component, inject } from '@angular/core';
import { EstablishmentContext } from '../../core/establishment-context';

@Component({
  selector: 'app-establishment-selector',
  templateUrl: './establishment-selector.html',
  styleUrl: './establishment-selector.css'
})
export class EstablishmentSelector {
  protected readonly context = inject(EstablishmentContext);

  changeEstablishment(event: Event) {
    this.context.select((event.target as HTMLSelectElement).value);
  }
}
