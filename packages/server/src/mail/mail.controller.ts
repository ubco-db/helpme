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

interface RequestUser {
  userId: string;
}

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
    const user = await UserTokenModel.findOne({
      where: {
        user: { id: userId },
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
      },
      relations: ['user'],
    });

    if (!user) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'No pending verification code found',
      });
    }

    user.createdAt = new Date();
    user.expiresIn = 1000 * 60 * 15;
    await user.save();

    this.mailerService
      .sendUserVerificationCode(user.token, user.user.email)
      .then();

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Verification code resent',
    });
  }
}
