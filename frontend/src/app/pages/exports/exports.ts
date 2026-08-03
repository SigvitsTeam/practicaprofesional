import { Component, output } from '@angular/core';

@Component({ selector: 'app-exports', templateUrl: './exports.html', styleUrl: './exports.css' })
export class Exports { readonly notify = output<string>(); }
