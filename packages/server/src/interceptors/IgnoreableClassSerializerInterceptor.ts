import {
  CallHandler,
  ClassSerializerInterceptor,
  ClassSerializerInterceptorOptions,
  CustomDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';

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
