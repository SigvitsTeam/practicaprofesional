import { Component, input, output } from '@angular/core';
import { NAV_ITEMS } from '../../core/mock-data';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  readonly active = input.required<string>();
  readonly navigate = output<string>();
  protected readonly items = NAV_ITEMS;
}
