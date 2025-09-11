import { Controller, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from '../profile/user-token.entity';
import { MailService } from './mail.service';
import { UserId } from '../decorators/user.decorator';

@Controller('mail')
// process emails
export class MailController {
  constructor(private mailerService: MailService) {}

  @UseGuards(JwtAuthGuard)
  @Post('registration/resend')
  async resendRegistrationToken(
    @Res() res: Response,
    @UserId() userId: number,
  ): Promise<Response<void>> {
    const token = await UserTokenModel.findOne({
      where: {
        user: { id: userId },
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
      },
      relations: ['user'],
    });

    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'No pending verification code found',
      });
    }

    token.createdAt = new Date();
    token.expiresIn = 1000 * 60 * 15;
    await token.save();

    this.mailerService
      .sendUserVerificationCode(token.token, token.user.email)
      .then();

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Verification code resent',
    });
  }
}
