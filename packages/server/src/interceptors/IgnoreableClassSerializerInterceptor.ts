import type {
  CallHandler,
  ClassSerializerInterceptorOptions,
  CustomDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { ClassSerializerInterceptor, SetMetadata } from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Reflector } from '@nestjs/core';

export class IgnoreableClassSerializerInterceptor extends ClassSerializerInterceptor {
  constructor(
    protected reflector: Reflector,
    protected defaultOptions: ClassSerializerInterceptorOptions,
  ) {
    super(reflector, defaultOptions);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ignore = this.reflector.get<boolean>(
      'ignore-serialization',
      context.getHandler(),
    );
    if (ignore) {
      return next.handle();
    }
    return super.intercept(context, next);
  }
}

export const IgnoreSerializer = (): CustomDecorator =>
  SetMetadata('ignore-serialization', true);
