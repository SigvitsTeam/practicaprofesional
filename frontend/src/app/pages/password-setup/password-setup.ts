import { Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EmailAccessService } from '../../core/email-access.service';

@Component({
  selector: 'app-password-setup',
  imports: [ReactiveFormsModule],
  templateUrl: './password-setup.html',
  styleUrl: './password-setup.css',
})
export class PasswordSetup {
  readonly access = inject(EmailAccessService);
  readonly exit = output<void>();
  readonly visible = signal(false);
  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true }),
    confirmation: new FormControl('', { nonNullable: true }),
  });

  async submit(): Promise<void> {
    const { password, confirmation } = this.form.getRawValue();
    if (await this.access.setPassword(password, confirmation)) this.form.reset();
  }
}
