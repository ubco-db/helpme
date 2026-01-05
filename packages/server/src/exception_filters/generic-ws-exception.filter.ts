import { ArgumentsHost, Logger, WsExceptionFilter } from '@nestjs/common';
import { isObject } from '@nestjs/common/utils/shared.utils';
import { MESSAGES } from '@nestjs/core/constants';
import { ErrorPayload, WsException } from '@nestjs/websockets';
import { IntrinsicException } from '@nestjs/common/exceptions/intrinsic.exception';
import { SentryExceptionCaptured } from '@sentry/nestjs';

type Func = (event: string, ...args: any[]) => void;

/* This is the base WS exception filter take from Nest.js

  It had an issue where the object check in 'handleUnknownError' would fail due to the object being checked
  not being an object.
  Added a @SentryExceptionCaptured() decorator so that sentry logs the exceptions to match
  with generic-exception-filter.ts

*/
export class BaseWsExceptionFilter<
  TError = any,
> implements WsExceptionFilter<TError> {
  protected static readonly logger = new Logger('WsExceptionsHandler');

  @SentryExceptionCaptured()
  public catch(exception: TError, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const pattern = host.switchToWs().getPattern();
    const data = host.switchToWs().getData();
    this.handleError(client, exception, {
      pattern,
      data,
    });
  }

  public handleError<TClient extends { emit: Func }>(
    client: TClient,
    exception: TError,
    cause: ErrorPayload['cause'],
  ) {
    if (!(exception instanceof WsException)) {
      return this.handleUnknownError(exception, client, cause);
    }

    const status = 'error';
    const result = exception.getError();

    if (isObject(result)) {
      return client.emit('exception', result);
    }

    const payload: ErrorPayload<unknown> = {
      status,
      message: result,
    };

    client.emit(cause.pattern, payload);
  }

  public handleUnknownError<TClient extends { emit: Func }>(
    exception: TError,
    client: TClient,
    data: ErrorPayload['cause'],
  ) {
    const status = 'error';
    const payload: ErrorPayload<unknown> = {
      status,
      message: MESSAGES.UNKNOWN_EXCEPTION_MESSAGE,
    };

    client.emit(data.pattern, payload);

    if (
      !this.isExceptionObject(exception) ||
      !(exception instanceof IntrinsicException)
    ) {
      const logger = BaseWsExceptionFilter.logger;
      logger.error(exception);
    }
  }

  public isExceptionObject(err: any): err is Error {
    return isObject(err) && !!(err as Error).message;
  }
}
