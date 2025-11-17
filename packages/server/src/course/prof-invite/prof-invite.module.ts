import { Module } from '@nestjs/common';
import { OrganizationModule } from 'organization/organization.module';
import { MailModule } from 'mail/mail.module';
import { ProfInviteController } from './prof-invite.controller';
import { ProfInviteService } from './prof-invite.service';
import { OrganizationService } from 'organization/organization.service';

// Made this its own module since imo it's better organised this way than shoving it all into course module (also it helps solve nestjs import dependency issue)
// It's also probably not a bad rule of thumb that if you can CRUD it, it can probably be made into its own controller + module
@Module({
  controllers: [ProfInviteController],
  imports: [OrganizationModule, MailModule],
  providers: [ProfInviteService, OrganizationService],
  exports: [ProfInviteService, OrganizationService],
})
export class ProfInviteModule {}
