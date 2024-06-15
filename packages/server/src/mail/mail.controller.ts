import {
  Controller,
  Post,
  Res,
  Req,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from '../profile/user-token.entity';
import { MailService } from './mail.service';

interface RequestUser {
  userId: string;
}

@Controller('mail')
export class MailController {
  constructor(private mailerService: MailService) {}

  @UseGuards(JwtAuthGuard)
  @Post('registration/resend')
  async resendRegistrationToken(
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<Response<void>> {
    const user = await UserTokenModel.findOne({
      where: {
        user: { id: Number((req.user as RequestUser).userId) },
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

    user.expires_at =
      parseInt(new Date().getTime().toString()) + 1000 * 60 * 15;
    await user.save();

    this.mailerService.sendUserVerificationCode(user.token, user.user.email);

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Verification code resent',
    });
  }
}
