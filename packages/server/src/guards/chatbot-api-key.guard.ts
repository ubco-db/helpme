import { Request } from 'express';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ChatbotApiKeyGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return await this.checkToken(context.switchToHttp().getRequest());
  }

  async checkToken(req: Request) {
    const apiKey = req.headers['hms-api-key'];
    const validApiKey = process.env.CHATBOT_API_KEY;

    if (!apiKey || apiKey !== validApiKey) {
      throw new HttpException(
        'Invalid or missing API key',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return true;
  }
}
