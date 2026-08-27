import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { apiAuthInterceptor } from './core/api-auth.interceptor';
import { routes } from './app.routes';
import { RuntimeConfigService } from './core/runtime-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => inject(RuntimeConfigService).load()),
    provideHttpClient(withInterceptors([apiAuthInterceptor])),
    provideRouter(routes),
  ],
};
