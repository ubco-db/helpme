import {
  MailServiceType,
  OrganizationRole,
  OrgRoleChangeReason,
  QUERY_PARAMS,
  Role,
} from '@koh/common';
import { Injectable } from '@nestjs/common';

import { UserCourseModel } from 'profile/user-course.entity';
import { UserModel } from 'profile/user.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { ProfInviteModel } from './prof-invite.entity';
import { OrganizationService } from 'organization/organization.service';
import { randomBytes } from 'node:crypto';
import { MailService } from 'mail/mail.service';

@Injectable()
export class ProfInviteService {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly mailService: MailService,
  ) {}

  async createProfInvite(
    orgId: number,
    courseId: number,
    adminUserId: number,
    maxUses?: number,
    expiresAt?: Date,
    makeOrgProf?: boolean,
  ): Promise<ProfInviteModel> {
    return await ProfInviteModel.create({
      orgId,
      courseId,
      adminUserId,
      code: randomBytes(6).toString('hex'), // 12 character long string. Could go longer but the invite url will look more gross
      // if no expiresAt is provided, set it to 7 days from now
      expiresAt: expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      makeOrgProf, // defaults to true
      maxUses, // defaults to 1
    }).save();
  }

  async acceptProfInviteFromCookie(
    userId: number,
    profInviteCookie: string,
  ): Promise<string> {
    const decodedCookie = decodeURIComponent(profInviteCookie);
    const splitCookie = decodedCookie.split(',');
    const profInviteId = Number(splitCookie[0]);
    // const orgId = splitCookie[1]; // these are part of the cookie but not used for this.
    // const courseId = splitCookie[2];
    const profInviteCode = splitCookie[3];
    return this.acceptProfInvite(userId, profInviteId, profInviteCode);
  }

  /* This will accept and consume a prof invite, sending any relevant emails to the admin that created it asynchronously */
  async acceptProfInvite(
    userId: number,
    profInviteId: number,
    profInviteCode: string,
  ): Promise<string> {
    // must return a string since we're using this in a redirect URL

    const profInvite = await ProfInviteModel.findOne({
      where: { id: profInviteId },
      relations: {
        course: true,
        adminUser: {
          organizationUser: true,
        },
      },
    });
    if (!profInvite) {
      console.error(
        `Someone tried to accept a prof invite that does not exist (invalid id). Given inputs: \nprofInviteId:${profInviteId}\nuserId:${userId}\nprofInviteCode:${profInviteCode}`,
      );
      const params = new URLSearchParams({
        err: QUERY_PARAMS.profInvite.error.notFound,
        [QUERY_PARAMS.profInvite.error.profInviteId]: profInviteId.toString(),
      });
      return `/courses?${params.toString()}`;
    }

    // check if already in course (if so, just redirect and don't consume invite)
    // Note that this check happens before the invite expiry check (Meaning that as long as you are in the course, you can always use this link to navigate to the course page. Since I imagine some profs will keep using the same link to get to their course)
    const user = await UserModel.findOne({
      where: { id: userId },
      relations: {
        courses: true,
        organizationUser: true,
      },
    });
    if (!user || !user.organizationUser) {
      const params = new URLSearchParams({
        err: QUERY_PARAMS.profInvite.error.userNotFound,
      });
      return `/courses?${params.toString()}`;
    }
    const existingUserCourse = user.courses.find(
      (uc) => uc.courseId === profInvite.courseId,
    );

    if (
      existingUserCourse &&
      user.organizationUser.role !== OrganizationRole.ADMIN
    ) {
      if (existingUserCourse.role === Role.PROFESSOR) {
        return `/course/${profInvite.courseId}`; // no notice if you're just a prof already in the course
      } else {
        // Weird case: The user is already in the course as a student or TA.
        // In this case, the admin messed up and should promote them manually.

        const email = this.constructAlreadyStudentEmail(
          user,
          profInvite,
          profInviteCode,
        );
        this.mailService.sendEmail({
          receiverOrReceivers: profInvite.adminUser.email,
          type: MailServiceType.ADMIN_NOTICE,
          subject: email.subject,
          content: email.content,
        });
        return `/course/${profInvite.courseId}`;
      }
    }

    // check "if used", "if expired", then "if invite code is correct". Checking "if used" first simply because the email notice will be more accurate (as it's likely the prof logged in with the wrong account).
    if (profInvite.usesUsed >= profInvite.maxUses) {
      if (user.organizationUser.role !== OrganizationRole.ADMIN) {
        const email = this.constructAlreadyUsedEmail(
          user,
          profInvite,
          profInviteCode,
        );
        this.mailService.sendEmail({
          receiverOrReceivers: profInvite.adminUser.email,
          type: MailServiceType.ADMIN_NOTICE,
          subject: email.subject,
          content: email.content,
        });
      }
      const params = new URLSearchParams({
        err: QUERY_PARAMS.profInvite.error.maxUsesReached,
        [QUERY_PARAMS.profInvite.error.maxUses]: profInvite.maxUses.toString(),
      });
      return `/courses?${params.toString()}`;
    }
    if (profInvite.expiresAt < new Date()) {
      if (user.organizationUser.role !== OrganizationRole.ADMIN) {
        const email = this.constructExpiredEmail(
          user,
          profInvite,
          profInviteCode,
        );
        this.mailService.sendEmail({
          receiverOrReceivers: profInvite.adminUser.email,
          type: MailServiceType.ADMIN_NOTICE,
          subject: email.subject,
          content: email.content,
        });
      }
      const params = new URLSearchParams({
        err: QUERY_PARAMS.profInvite.error.expired,
        [QUERY_PARAMS.profInvite.error.expiresAt]:
          profInvite.expiresAt.toLocaleDateString(),
      });
      return `/courses?${params.toString()}`;
    }
    if (profInvite.code !== profInviteCode) {
      if (user.organizationUser.role !== OrganizationRole.ADMIN) {
        const email = this.constructWrongCodeEmail(
          user,
          profInvite,
          profInviteCode,
        );
        this.mailService.sendEmail({
          receiverOrReceivers: profInvite.adminUser.email,
          type: MailServiceType.ADMIN_NOTICE,
          subject: email.subject,
          content: email.content,
        });
      }
      const params = new URLSearchParams({
        err: QUERY_PARAMS.profInvite.error.badCode,
      });
      return `/courses?${params.toString()}`;
    }

    // Check to see if the user is already in the course AFTER other checks since it's assumed that admins only click on a prof invite link to check if it's working
    if (user.organizationUser.role === OrganizationRole.ADMIN) {
      if (existingUserCourse) {
        const params = new URLSearchParams({
          notice: QUERY_PARAMS.profInvite.notice.adminAlreadyInCourse,
        });
        return `/course/${profInvite.courseId}?${params.toString()}`;
      } else {
        // This covers two cases:
        // A: Admin wanted to test to make sure the invite was working
        // B: Another admin accepted the prof invite

        // add user to the course as a professor but don't bother changing their orgRole
        await UserCourseModel.create({
          userId,
          courseId: profInvite.courseId,
          role: Role.PROFESSOR,
        }).save();

        if (user.id !== profInvite.adminUserId) {
          const email = this.constructAdminAcceptedEmail(
            user,
            profInvite,
            profInviteCode,
          );
          this.mailService.sendEmail({
            receiverOrReceivers: profInvite.adminUser.email,
            type: MailServiceType.ADMIN_NOTICE,
            subject: email.subject,
            content: email.content,
          });
        }
        const params = new URLSearchParams({
          notice: QUERY_PARAMS.profInvite.notice.adminAcceptedInviteNotConsumed,
        });
        return `/course/${profInvite.courseId}?${params.toString()}`;
      }
    }

    // STANDARD CASE: add user to the course as a professor
    await UserCourseModel.create({
      userId,
      courseId: profInvite.courseId,
      role: Role.PROFESSOR,
    }).save();
    profInvite.usesUsed++;
    await profInvite.save();
    if (
      profInvite.makeOrgProf &&
      user.organizationUser.role === OrganizationRole.MEMBER
    ) {
      await OrganizationUserModel.update(
        {
          userId: userId,
          organizationId: user.organizationUser.organizationId,
        },
        { role: OrganizationRole.PROFESSOR },
      );
      await this.organizationService.addRoleHistory(
        // I didn't forget to do this because I'm one smart cookie
        user.organizationUser.organizationId,
        OrganizationRole.MEMBER,
        OrganizationRole.PROFESSOR,
        profInvite.adminUser.organizationUser.id,
        user.organizationUser.id,
        OrgRoleChangeReason.acceptedProfInvite,
      );
    }

    const remainingUses = profInvite.maxUses - profInvite.usesUsed;
    const email = this.constructSuccessEmail(
      user,
      profInvite,
      profInviteCode,
      remainingUses,
    );
    this.mailService.sendEmail({
      receiverOrReceivers: profInvite.adminUser.email,
      type: MailServiceType.ADMIN_NOTICE,
      subject: email.subject,
      content: email.content,
    });
    const params = new URLSearchParams({
      notice: QUERY_PARAMS.profInvite.notice.inviteAccepted,
    });
    return `/course/${profInvite.courseId}?${params.toString()}`;
  }

  // --- Email Construction Helpers --- Used for tests

  public getCommonEmailBody(
    profInvite: ProfInviteModel,
    profInviteCodeAttempt?: string,
  ): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <p>View the course (Note that this link won't work if you're not already in the course): <a href="${process.env.DOMAIN}/course/${profInvite.courseId}">${process.env.DOMAIN}/course/${profInvite.courseId}</a></p>
        <p>You are receiving this email because you are the admin who created the prof invite.</p>
        <p><b>Full Prof Invite Details:</b></p>
        <table style="border-collapse: collapse; margin-top: 8px;">
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Invite ID</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.id}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Course ID</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.courseId}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Course Name</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.course.name}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Created At</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.createdAt instanceof Date ? profInvite.createdAt.toLocaleString() : profInvite.createdAt}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Expires At</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.expiresAt instanceof Date ? profInvite.expiresAt.toLocaleString() : profInvite.expiresAt}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Uses</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.usesUsed} / ${profInvite.maxUses}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Make Org Prof</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.makeOrgProf ? 'Yes' : 'No'}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 6px;"><b>Invite Code</b></td>
            <td style="border: 1px solid #ddd; padding: 6px;">${profInvite.code}</td>
          </tr>
        </table>
        ${profInviteCodeAttempt && profInviteCodeAttempt !== profInvite.code ? `<p>Note that the given prof invite code (${profInviteCodeAttempt}) <b>does not match</b> the real prof invite code (${profInvite.code}). This probably means the request was malicious!</p>` : ''}
      </div>
    `;
  }

  public getCommonEmailBodyUserInfo(user: UserModel): string {
    return `<p style="margin-bottom: 4px;">Acceptee User Details - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}</p>`;
  }

  public constructAlreadyStudentEmail(
    user: UserModel,
    profInvite: ProfInviteModel,
    profInviteCode: string,
  ): { subject: string; content: string } {
    return {
      subject: `HelpMe (Admin) - Prof Invite for ${profInvite.course.name} Could Not Be Accepted: Needs Manual Promotion`,
      content: `<p style="margin-bottom: 4px;">A user attempted to accept the professor invite for ${profInvite.course.name} <b>but they are already in the course as a student or TA</b>. In this case, you must promote them manually. Or, in case this was the result of a leaked invite, you should delete the old prof invite and create a new one.</p>
          ${this.getCommonEmailBodyUserInfo(user)}
          ${this.getCommonEmailBody(profInvite, profInviteCode)}`,
    };
  }

  public constructAlreadyUsedEmail(
    user: UserModel,
    profInvite: ProfInviteModel,
    profInviteCode: string,
  ): { subject: string; content: string } {
    return {
      subject: `HelpMe (Admin) - User Attempted to Accept Already-Used Prof Invite for ${profInvite.course.name}`,
      content: `<p style="margin-bottom: 4px;">A user attempted to accept a professor invite for ${profInvite.course.name} <b>but the prof invite is already used</b>. They were notified as such but the invite was not accepted. </p>
          <p style="margin-bottom: 4px;">In this case, you should verify the acceptee was who you were expecting and then email them a new prof invite (since the prof might've logged in with two different accounts). OR investigate if this link was leaked somewhere.</p>
          ${this.getCommonEmailBodyUserInfo(user)}
          ${this.getCommonEmailBody(profInvite, profInviteCode)}`,
    };
  }

  public constructExpiredEmail(
    user: UserModel,
    profInvite: ProfInviteModel,
    profInviteCode: string,
  ): { subject: string; content: string } {
    return {
      subject: `HelpMe (Admin) - User Attempted to Accept Expired Prof Invite for ${profInvite.course.name}`,
      content: `<p style="margin-bottom: 4px;">A user attempted to accept a professor invite for ${profInvite.course.name} <b>but the prof invite is expired</b>. They were notified as such but the invite was not accepted. </p>
          <p style="margin-bottom: 4px;">In this case, you should verify the acceptee was who you were expecting and then email them a new prof invite (since the prof might've forgotten). OR investigate if this link was leaked somewhere.</p>
          ${this.getCommonEmailBodyUserInfo(user)}
          ${this.getCommonEmailBody(profInvite, profInviteCode)}`,
    };
  }

  public constructWrongCodeEmail(
    user: UserModel,
    profInvite: ProfInviteModel,
    profInviteCode: string,
  ): { subject: string; content: string } {
    return {
      subject: `HelpMe (Admin) - User Attempted to Accept Prof Invite for ${profInvite.course.name} With Wrong Invite Code`,
      content: `<p style="margin-bottom: 4px;">A user attempted to accept a professor invite for ${profInvite.course.name} <b>but the invite code was incorrect</b>. They were notified as such but the invite was not accepted. </p>
          <p style="margin-bottom: 4px;">In this case, it is either a problem with the system or someone malicious. Please verify the acceptee details to see who is trying to access this and address it accordingly.</p>
          ${this.getCommonEmailBodyUserInfo(user)}
          ${this.getCommonEmailBody(profInvite, profInviteCode)}`,
    };
  }

  public constructAdminAcceptedEmail(
    user: UserModel,
    profInvite: ProfInviteModel,
    profInviteCode: string,
  ): { subject: string; content: string } {
    return {
      subject: `HelpMe (Admin) - Another Admin Accepted Your Prof Invite for ${profInvite.course.name} (Not Consumed)`,
      content: `<p style="margin-bottom: 4px;">An admin accepted your professor invite and has been added to ${profInvite.course.name} as a professor. Because they were an admin, the invite was not consumed (they were also notified of this).</p>
            <p style="margin-bottom: 4px;">In this case, if the user you were trying to invite to the course <i>was</i> the admin, you should not do this since it is expected the admin adds themselves to the course (you should also delete the prof invite in this case). Otherwise, you can disregard this email.</p>
            ${this.getCommonEmailBodyUserInfo(user)}
            ${this.getCommonEmailBody(profInvite, profInviteCode)}`,
    };
  }

  public constructSuccessEmail(
    user: UserModel,
    profInvite: ProfInviteModel,
    profInviteCode: string,
    remainingUses: number,
  ): { subject: string; content: string } {
    return {
      subject: `HelpMe (Admin) - ${user.name} Accepted Your Prof Invite for ${profInvite.course.name}${remainingUses > 0 ? ` (${remainingUses} Uses Remaining)` : ' (Consumed)'}`,
      content: `<p style="margin-bottom: 4px;">${user.name} accepted your professor invite and has been added to ${profInvite.course.name} as a professor.</p>
      <p style="margin-bottom: 4px;">Doing so has consumed the professor invite, and there are ${remainingUses} uses remaining.</p>
      ${profInvite.makeOrgProf && user.organizationUser.role === OrganizationRole.MEMBER ? `<p style="margin-bottom: 4px;">Because makeOrgProf was true (and they were not already an org prof), the user was also made into an organization professor.</p>` : ''}
      ${this.getCommonEmailBodyUserInfo(user)}
      ${this.getCommonEmailBody(profInvite, profInviteCode)}`,
    };
  }
}
