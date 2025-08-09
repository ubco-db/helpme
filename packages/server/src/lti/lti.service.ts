import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform, Provider } from 'ltijs';
import { LTIConfigModel } from './organization-lti-config.entity';
import { pick } from 'lodash';
import { isProd } from '@koh/common';

@Injectable()
export default class LTIService {
  private platforms: Record<string, Platform> = {};

  constructor(configService: ConfigService) {
    this.initializeLTIConnection(configService).then();
  }

  private async initializeLTIConnection(configService: ConfigService) {
    Provider.setup(
      'KEY',
      {
        url: !isProd()
          ? `postgres://${configService.get<string>('POSTGRES_USER')}:${configService.get<string>('POSTGRES_PASSWORD')}@localhost:5432/lti`
          : `postgres://${configService.get<string>('POSTGRES_NONROOT_USER')}:${configService.get<string>('POSTGRES_NONROOT_PASSWORD')}@coursehelp.ubc.ca:5432/lti`,
      },
      {
        appUrl: `${configService.get<string>('DOMAIN')}`,
        loginUrl: `${configService.get<string>('DOMAIN')}/api/v1/lti/auth`,
        invalidTokenUrl: `${configService.get<string>('DOMAIN')}/lti/invalid_token`,
        https: true,
      },
    );
    await Provider.deploy({ serverless: true });

    const orgConfigs = await LTIConfigModel.find();
    for (const orgConfig of orgConfigs) {
      await this.initializeOrganizationLTIConnection(orgConfig);
    }
  }

  private async initializeOrganizationLTIConnection(ltiConfig: LTIConfigModel) {
    const result = await Provider.registerPlatform({
      ...pick(ltiConfig, [
        'url',
        'name',
        'clientId',
        'authenticationEndpoint',
        'accesstokenEndpoint',
        'authConfig',
      ]),
    });
    if (result) {
      this.platforms[ltiConfig.name] = result;
    }
  }

  private async clearOrganizationLTIConnection(ltiConfig: LTIConfigModel) {
    if (this.platforms[ltiConfig.name]) {
      await this.platforms[ltiConfig.name].remove();
    }
    delete this.platforms[ltiConfig.name];
  }

  async createOrganizationLTIConnection() {
    const inserted = await LTIConfigModel.create({}).save();
    await this.initializeOrganizationLTIConnection(inserted);
  }

  async updateOrganizationLTIConnection(ltiConfigId: number, params: any) {
    const config = await LTIConfigModel.findOne({ where: { id: ltiConfigId } });
    if (!config) {
      throw new NotFoundException();
    }
    await LTIConfigModel.update({ id: ltiConfigId }, params);
    await this.clearOrganizationLTIConnection(config);
    await config.reload();
    await this.initializeOrganizationLTIConnection(config);
  }

  async removeOrganizationLTIConnection(ltiConfigId: number) {
    const config = await LTIConfigModel.findOne({ where: { id: ltiConfigId } });
    if (!config) {
      throw new NotFoundException();
    }
    await LTIConfigModel.delete({ id: ltiConfigId });
    await this.clearOrganizationLTIConnection(config);
  }
}
