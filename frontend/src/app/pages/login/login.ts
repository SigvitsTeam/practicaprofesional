import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthenticationError, AuthService } from '../../core/auth.service';
import { RuntimeConfigService } from '../../core/runtime-config.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  readonly loading = signal(false);
  readonly passwordVisible = signal(false);
  readonly error = signal('');
  readonly recoveryMessage = signal('');
  readonly demoEnabled =
    this.runtimeConfig.auth.demoEnabled && !this.runtimeConfig.auth.supabaseUrl;
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    remember: new FormControl(false, { nonNullable: true }),
  });

  async submit(): Promise<void> {
    this.error.set('');
    this.recoveryMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.signIn(this.form.getRawValue());
    } catch (error) {
      this.error.set(
        error instanceof AuthenticationError ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  useDemo(): void {
    this.form.patchValue({
      email: this.runtimeConfig.auth.demoEmail,
      password: this.runtimeConfig.auth.demoPassword,
    });
    void this.submit();
  }

  async recoverPassword(): Promise<void> {
    const email = this.form.controls.email;
    this.error.set('');
    this.recoveryMessage.set('');
    if (email.invalid) {
      email.markAsTouched();
      this.error.set('Escribe primero tu correo institucional.');
      return;
    }
    this.loading.set(true);
    try {
      await this.auth.requestPasswordReset(email.value);
      this.recoveryMessage.set(
        'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.',
      );
    } catch (error) {
      this.error.set(
        error instanceof AuthenticationError
          ? error.message
          : 'No fue posible procesar la solicitud.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
