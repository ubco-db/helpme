import { WsException } from '@nestjs/websockets';
import { HttpStatus } from '@nestjs/common';

export class WebSocketException extends WsException {
  constructor(status: HttpStatus, message?: string) {
    super({
      status,
      message: message ?? HttpStatus[status] ?? 'Unknown Error',
    });
  }
}

export class WsUnauthorizedException extends WebSocketException {
  constructor(message?: string) {
    super(HttpStatus.UNAUTHORIZED, message);
  }
}

export class WsForbiddenException extends WebSocketException {
  constructor(message?: string) {
    super(HttpStatus.FORBIDDEN, message);
  }
}

export class WsBadRequestException extends WebSocketException {
  constructor(message?: string) {
    super(HttpStatus.BAD_REQUEST, message);
  }
}

export class WsNotFoundException extends WebSocketException {
  constructor(message?: string) {
    super(HttpStatus.NOT_FOUND, message);
  }
}
