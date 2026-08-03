import { Component, output } from '@angular/core';

@Component({ selector: 'app-territory', templateUrl: './territory.html', styleUrl: './territory.css' })
export class Territory { readonly notify = output<string>(); }
