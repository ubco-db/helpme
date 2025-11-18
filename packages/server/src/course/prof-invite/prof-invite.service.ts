import {
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

@Injectable()
export class ProfInviteService {
  constructor(private readonly organizationService: OrganizationService) {}

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

  async acceptProfInvite(
    userId: number,
    profInviteId: number,
    profInviteCode: string,
  ): Promise<string> {
    // must return a string since we're using this in a redirect URL

    const profInvite = await ProfInviteModel.findOne({
      where: { id: profInviteId },
    });
    if (!profInvite) {
      return `/courses?err=${QUERY_PARAMS.profInvite.error.notFound}&${QUERY_PARAMS.profInvite.error.profInviteId}=${profInviteId}`;
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
    if (!user) {
      return `/courses?err=${QUERY_PARAMS.profInvite.error.userNotFound}`;
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

        // TODO: send email that says this
        return `/course/${profInvite.courseId}`;
      }
    }

    if (profInvite.expiresAt < new Date()) {
      return `/courses?err=${QUERY_PARAMS.profInvite.error.expired}&${QUERY_PARAMS.profInvite.error.expiresAt}=${profInvite.expiresAt.toLocaleDateString()}`;
    }
    if (profInvite.usesUsed >= profInvite.maxUses) {
      return `/courses?err=${QUERY_PARAMS.profInvite.error.maxUsesReached}&${QUERY_PARAMS.profInvite.error.maxUses}=${profInvite.maxUses}`;
    }
    if (profInvite.code !== profInviteCode) {
      return `/courses?err=${QUERY_PARAMS.profInvite.error.badCode}`;
    }
    // Do this check AFTER other checks since it's assumed that admins only click on a prof invite link to check if it's working
    if (user.organizationUser.role === OrganizationRole.ADMIN) {
      if (existingUserCourse) {
        return `/course/${profInvite.courseId}?notice=${QUERY_PARAMS.profInvite.notice.adminAlreadyInCourse}`;
      } else {
        await UserCourseModel.create({
          userId,
          courseId: profInvite.courseId,
          role: Role.PROFESSOR,
        }).save();

        // TODO: send email
        return `/course/${profInvite.courseId}?notice=${QUERY_PARAMS.profInvite.notice.adminAcceptedInviteNotConsumed}`;
      }
    }

    // add user to the course as a professor
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
        user.organizationUser.organizationId,
        OrganizationRole.MEMBER,
        OrganizationRole.PROFESSOR,
        profInvite.adminUserId,
        userId,
        OrgRoleChangeReason.acceptedProfInvite,
      );
      // TODO: send email
    } else {
      // TODO: send email
    }
    return `/course/${profInvite.courseId}?notice=${QUERY_PARAMS.profInvite.notice.inviteAccepted}`;
  }
}
