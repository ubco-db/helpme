import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

// Catch 429 errors, log them in sentry, and return a 429 status code with a message

@Catch(ThrottlerException)
export class RateLimitExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Log the 429 error to Sentry
    // note that this will also capture when the user attempts to login 7+ times in a minute (just for data purposes)
    Sentry.captureException(exception, {
      contexts: {
        request: {
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          query: request.query,
        },
      },
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: 'Too many requests, please wait 1s',
    });
  }
}
