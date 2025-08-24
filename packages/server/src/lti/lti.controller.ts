import { BadRequestException, Controller, Get, Req, Res } from '@nestjs/common';
import * as Express from 'express';
import { LoginController } from '../login/login.controller';
import { JwtService } from '@nestjs/jwt';
import { ERROR_MESSAGES } from '@koh/common';
import { LtiService } from './lti.service';
import { IdToken } from 'lti-typescript';

@Controller('lti')
export class LtiController {
  constructor(
    private jwtService: JwtService,
    private ltiService: LtiService,
  ) {}

  @Get('login')
  async ltiLogin(@Req() req: Express.Request, @Res() res: Express.Response) {
    const idToken: IdToken = res.locals.token;
    if (!idToken) {
      throw new BadRequestException(
        ERROR_MESSAGES.ltiController.missingIdToken,
      );
    }
    const userCourseId = await this.ltiService.findMatchingUserCourse(idToken);
    // Expires in 10 minutes
    const auth_token = await LoginController.generateAuthToken(
      userCourseId,
      this.jwtService,
      600,
    );
    res
      .status(200)
      .setHeader('Content-Type', 'application/html; charset=UTF-8')
      .send(
        `
        <script>
          (window.opener || window.parent).postMessage(
              {
                  subject:"lti.put_data"
                  message_id: '1' //TODO: GENERATE UNIQUE IDENTIFIER
                  key: 'auth',
                  value: ${auth_token}, 
              }, 
              "*"
          );
        </script>
      `,
      );
  }
}
