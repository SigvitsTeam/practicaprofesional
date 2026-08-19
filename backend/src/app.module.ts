import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GlobalHttpExceptionFilter } from './common/http/http-exception.filter';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { appConfig, authConfig, databaseConfig } from './config/app.config';
import { environmentSchema } from './config/environment.validation';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AuthenticationGuard } from './modules/authorization/http/authentication.guard';
import { AuthorizationGuard } from './modules/authorization/http/authorization.guard';
import { HealthModule } from './modules/health/health.module';
import { ItsCaptureModule } from './modules/its-capture/its-capture.module';
import { TerritorialModule } from './modules/territorial/territorial.module';
import { UserAdminModule } from './modules/user-admin/user-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [appConfig, databaseConfig, authConfig],
      validationSchema: environmentSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('app.throttleTtlMs'),
          limit: config.getOrThrow<number>('app.throttleLimit'),
        },
      ],
    }),
    HealthModule,
    AuthorizationModule,
    TerritorialModule,
    UserAdminModule,
    ItsCaptureModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_GUARD, useExisting: AuthorizationGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
