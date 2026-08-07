import { Component, input, output } from '@angular/core';
import { RoleProfile } from '../../core/models';

@Component({
  selector: 'app-role-dashboard',
  templateUrl: './role-dashboard.html',
  styleUrl: './role-dashboard.css'
})
export class RoleDashboard {
  readonly role = input.required<RoleProfile>();
  readonly navigate = output<string>();
  readonly notify = output<string>();

  openTask(target: string | undefined, title: string) {
    if (target) this.navigate.emit(target);
    else this.notify.emit(`${title}: seguimiento registrado en la vista simulada.`);
  }
}
