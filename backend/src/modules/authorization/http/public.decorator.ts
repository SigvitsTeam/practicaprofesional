import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_KEY = 'authorization:public';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE_KEY, true);
