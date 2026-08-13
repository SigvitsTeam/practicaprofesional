import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiUrl)) return next(request);
  const auth = inject(AuthService);
  return from(auth.getValidAccessToken()).pipe(
    switchMap(token => next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request)),
  );
};
