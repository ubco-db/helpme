import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';
import { Filter, INSIGHTS_MAP } from './insight-objects';
import {
  InsightDashboardPartial,
  InsightDetail,
  InsightObject,
  ListInsightsResponse,
  PossibleOutputTypes,
  Role,
} from '@koh/common';
import { UserModel } from 'profile/user.entity';
import { Cache } from 'cache-manager';
import { UserCourseModel } from '../profile/user-course.entity';
import { InsightDashboardModel } from './dashboard.entity';

type ComputeOutputParams = {
  insight: InsightObject;
  filters: Filter[];
};

type GenerateAllInsightParams = {
  insights: InsightObject[];
  filters: Filter[];
};

@Injectable()
export class InsightsService {
  constructor(
    private connection: Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Compute the output data for an insight and add it to the insight response
  async computeOutput({
    insight,
    filters,
  }: ComputeOutputParams): Promise<PossibleOutputTypes> {
    return await insight.compute(filters, this.cacheManager);
  }

  async generateAllInsights({
    insights,
    filters,
  }: GenerateAllInsightParams): Promise<PossibleOutputTypes[]> {
    return await Promise.all(
      insights.map(
        async (insight) => await this.computeOutput({ insight, filters }),
      ),
    );
  }

  convertToInsightsListResponse(insightNames: string[]): ListInsightsResponse {
    return insightNames.reduce((obj, insightName) => {
      const { displayName, description, insightType } =
        INSIGHTS_MAP[insightName];
      return {
        ...obj,
        [insightName]: {
          displayName,
          description,
          insightType,
        },
      };
    }, {});
  }

  async toggleInsightOn(
    user: UserModel,
    insightName: string,
  ): Promise<string[]> {
    user.hideInsights = user.hideInsights?.filter(
      (insight) => insight !== insightName,
    );
    await user.save();
    return;
  }

  async toggleInsightOff(user: UserModel, insightName: string): Promise<void> {
    if (user.hideInsights === null) {
      user.hideInsights = [];
    }
    user.hideInsights = [insightName, ...user.hideInsights];
    await user.save();
    return;
  }

  mapDashboardPartial(insightDashboard: InsightDashboardModel) {
    return {
      name: insightDashboard.name,
      insights: insightDashboard.insights,
    };
  }

  async getDashboardPresets(
    user: UserModel,
    courseId: number,
    userCourse?: UserCourseModel,
  ): Promise<InsightDashboardPartial[]> {
    if (!userCourse) {
      userCourse = await UserCourseModel.findOne({
        where: { user, courseId },
      });

      if (!userCourse || userCourse.role != Role.PROFESSOR) {
        return [];
      }
    }

    const allPresets = await InsightDashboardModel.find({
      where: { userCourse },
    });

    return allPresets.map(this.mapDashboardPartial);
  }

  async upsertDashboardPreset(
    user: UserModel,
    courseId: number,
    insights: InsightDetail,
    name?: string,
  ): Promise<InsightDashboardPartial[]> {
    const userCourse = await UserCourseModel.findOne({
      where: { user, courseId },
    });

    if (!userCourse || userCourse.role != Role.PROFESSOR) {
      return [];
    }

    const [_, count] = await InsightDashboardModel.findAndCount({
      where: { userCourse },
    });

    name ??= `Preset #${count + 1}`;
    await InsightDashboardModel.upsert(
      {
        userCourse,
        name,
        insights,
      },
      ['userCourseId', 'name'],
    );

    return await this.getDashboardPresets(user, courseId, userCourse);
  }

  async removeDashboardPreset(
    user: UserModel,
    courseId: number,
    name: string,
  ): Promise<InsightDashboardPartial[]> {
    const userCourse = await UserCourseModel.findOne({
      where: { user, courseId },
    });

    if (!userCourse) {
      return [];
    }

    const dashboard = await InsightDashboardModel.findOne({
      where: { userCourse, name },
    });

    if (!dashboard) {
      return await this.getDashboardPresets(user, courseId, userCourse);
    }

    await InsightDashboardModel.remove(dashboard);

    return await this.getDashboardPresets(user, courseId, userCourse);
  }
}
