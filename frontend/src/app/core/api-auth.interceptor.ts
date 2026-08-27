import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const runtimeConfig = inject(RuntimeConfigService);
  if (!request.url.startsWith(runtimeConfig.apiUrl)) return next(request);
  const auth = inject(AuthService);
  return from(auth.getValidAccessToken()).pipe(
    switchMap((token) =>
      next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request),
    ),
  );
};
