import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, DeepPartial } from 'typeorm';
import {
  initFactoriesFromService,
  UserFactory,
} from '../../test/util/factories';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { DesktopNotifModel } from './desktop-notif.entity';
import { NotificationService } from './notification.service';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule, FactoryModule],
      providers: [NotificationService],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    dataSource = module.get<DataSource>(DataSource);
    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  describe('registerDesktop', () => {
    it('does not create if already existing', async () => {
      const user = await UserFactory.create();
      const data: DeepPartial<DesktopNotifModel> = {
        userId: user.id,
        endpoint: 'bruh',
        p256dh: 'ji',
        auth: 'fd',
      };
      await service.registerDesktop(data);
      let dnotif = await DesktopNotifModel.find({
        where: {
          userId: user.id,
        },
      });
      expect(dnotif).toEqual([expect.objectContaining(data)]);

      // do it again, but it should skip
      await service.registerDesktop(data);
      dnotif = await DesktopNotifModel.find({
        where: {
          userId: user.id,
        },
      });
      expect(dnotif.length).toEqual(1);
    });
  });
});
