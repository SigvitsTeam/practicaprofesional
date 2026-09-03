import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GlobalHttpExceptionFilter } from './common/http/http-exception.filter';
import { HttpMetricsMiddleware } from './common/http/http-metrics.middleware';
import { RequestIdMiddleware } from './common/http/request-id.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { ObservabilityModule } from './common/observability/observability.module';
import { appConfig, authConfig, databaseConfig, exportConfig } from './config/app.config';
import { environmentSchema } from './config/environment.validation';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AuthenticationGuard } from './modules/authorization/http/authentication.guard';
import { AuthorizationGuard } from './modules/authorization/http/authorization.guard';
import { HealthModule } from './modules/health/health.module';
import { ItsCaptureModule } from './modules/its-capture/its-capture.module';
import { TerritorialModule } from './modules/territorial/territorial.module';
import { UserAdminModule } from './modules/user-admin/user-admin.module';
import { ExportsModule } from './modules/exports/exports.module';
import { ReportingAdminModule } from './modules/reporting-admin/reporting-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [appConfig, databaseConfig, authConfig, exportConfig],
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
    ObservabilityModule,
    HealthModule,
    AuthorizationModule,
    TerritorialModule,
    UserAdminModule,
    ItsCaptureModule,
    ExportsModule,
    ReportingAdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_GUARD, useExisting: AuthorizationGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    HttpMetricsMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, HttpMetricsMiddleware).forRoutes('{*path}');
  }
}
