import { Module } from '@nestjs/common';
import { AuthorizationPolicy } from './domain/authorization.policy';

@Module({ providers: [AuthorizationPolicy], exports: [AuthorizationPolicy] })
export class AuthorizationModule {}
