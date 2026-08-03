import { Component, input, output } from '@angular/core';

@Component({ selector: 'app-topbar', templateUrl: './topbar.html', styleUrl: './topbar.css' })
export class Topbar {
  readonly establishmentView = input(false);
  readonly darkMode = input(false);
  readonly themeToggle = output<void>();
}
