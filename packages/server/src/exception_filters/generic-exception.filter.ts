import {
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
  HttpServer,
  HttpStatus,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { isObject } from '@nestjs/common/utils/shared.utils';
import { AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core';
import { MESSAGES } from '@nestjs/core/constants';
import { SentryExceptionCaptured } from '@sentry/nestjs';

/* This is the base exception filter take from Nest.js
  It had an issue where isHeadersSent was not a function so I added a check for that
  and also added a @SentryExceptionCaptured() decorator so that sentry logs the exceptions

*/
export class BaseExceptionFilter<T = any> implements ExceptionFilter<T> {
  private static readonly logger = new Logger('ExceptionsHandler');

  @Optional()
  @Inject()
  protected readonly httpAdapterHost?: HttpAdapterHost;

  constructor(protected readonly applicationRef?: HttpServer) {}

  @SentryExceptionCaptured()
  catch(exception: T, host: ArgumentsHost) {
    const applicationRef =
      this.applicationRef ||
      (this.httpAdapterHost && this.httpAdapterHost.httpAdapter)!;

    if (!(exception instanceof HttpException)) {
      return this.handleUnknownError(exception, host, applicationRef);
    }
    const res = exception.getResponse();
    const message = isObject(res)
      ? res
      : {
          statusCode: exception.getStatus(),
          message: res,
        };

    const response = host.getArgByIndex(1);
    if (
      !applicationRef.isHeadersSent ||
      !applicationRef.isHeadersSent(response)
    ) {
      applicationRef.reply(response, message, exception.getStatus());
    } else {
      applicationRef.end(response);
    }
  }

  public handleUnknownError(
    exception: T,
    host: ArgumentsHost,
    applicationRef: AbstractHttpAdapter | HttpServer,
  ) {
    const body = this.isHttpError(exception)
      ? {
          statusCode: exception.statusCode,
          message: exception.message,
        }
      : {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: MESSAGES.UNKNOWN_EXCEPTION_MESSAGE,
        };

    const response = host.getArgByIndex(1);
    if (
      !applicationRef.isHeadersSent ||
      !applicationRef.isHeadersSent(response)
    ) {
      applicationRef.reply(response, body, body.statusCode);
    } else {
      applicationRef.end(response);
    }

    if (this.isExceptionObject(exception)) {
      return BaseExceptionFilter.logger.error(
        exception.message,
        exception.stack,
      );
    } else {
      return BaseExceptionFilter.logger.error(exception);
    }
  }

  public isExceptionObject(err: any): err is Error {
    return isObject(err) && !!(err as Error).message;
  }

  /**
   * Checks if the thrown error comes from the "http-errors" library.
   * @param err error object
   */
  public isHttpError(err: any): err is { statusCode: number; message: string } {
    return err?.statusCode && err?.message;
  }
}
