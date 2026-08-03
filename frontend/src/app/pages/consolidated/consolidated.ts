import { Component, output } from '@angular/core';

@Component({ selector: 'app-consolidated', templateUrl: './consolidated.html', styleUrl: './consolidated.css' })
export class Consolidated { readonly navigate = output<string>(); }
