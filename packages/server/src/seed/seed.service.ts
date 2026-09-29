import { OrganizationRole, MailServiceType } from '@koh/common';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FactoryService } from 'factory/factory.service';
import { MailServiceModel } from 'mail/mail-services.entity';
import { BackupService } from 'backup/backup.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execPromise = promisify(exec);

/**
 * Directory where dev backups are stored (relative to packages/server).
 */
const DEV_BACKUP_DIR = '../../backups';
const DEV_BACKUP_FILENAME = 'dev-backup.sql.gz';

/** Databases to drop before restoring a dev backup */
const DEV_DATABASES_TO_DROP = ['dev', 'chatbot'];

/** 10 minutes in ms — migration can be slow on some machines */
const LONG_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class SeedService {
  constructor(
    private dataSource: DataSource,
    private factoryService: FactoryService,
    private backupService: BackupService,
  ) {}

  async deleteAll(model: any): Promise<void> {
    await this.dataSource.createQueryBuilder().delete().from(model).execute();
  }

  // used to be located in organization.controller.ts
  async populateMailSubscriptionTable(): Promise<void> {
    // Get all users for the organization with their highest role
    // update: this query can probably be updated to just grab userids of all org users but this is a admin route so me
    const orgUsers: {
      userId: number;
      role: 'professor' | 'admin' | 'member';
    }[] = await this.dataSource.query(
      `
  SELECT ou."userId",
         CASE
           WHEN EXISTS (
             SELECT 1 
             FROM user_course_model uc 
             WHERE uc."userId" = ou."userId" AND uc.role != 'student'
           ) THEN 'professor'
           ELSE ou.role
         END AS role
  FROM organization_user_model ou
  `,
    );

    // Get all mail services
    const mailServices = await this.dataSource.query(`
        SELECT id, "mailType", "serviceType"
        FROM mail_services
      `);

    // Prepare arrays for bulk insert
    const subscriptionsToInsert = [];

    // instead of subscribing users to specific services based on their role, we are going to subscribe them to all services
    // And then we will simply add the staff checks to the controllers that send the emails
    // This is because roles are not static, and that it would be a lot more annoying to adjust all the endpoints that update roles to also update their subscription.
    // It's just a lot easier to check their role at the time the email needs to be sent then syncing this

    for (const user of orgUsers) {
      for (const service of mailServices) {
        subscriptionsToInsert.push([user.userId, service.id, true]);
      }
    }

    // Bulk insert subscriptions
    if (subscriptionsToInsert.length > 0) {
      await this.dataSource.query(
        `
          INSERT INTO user_subscriptions ("userId", "serviceId", "isSubscribed")
          SELECT u, s, e
          FROM unnest($1::int[], $2::int[], $3::boolean[]) AS t(u, s, e)
          WHERE NOT EXISTS (
            SELECT 1 
            FROM user_subscriptions us
            WHERE us."userId" = t.u AND us."serviceId" = t.s
          )
        `,
        [
          subscriptionsToInsert.map((s) => s[0]),
          subscriptionsToInsert.map((s) => s[1]),
          subscriptionsToInsert.map((s) => s[2]),
        ],
      );
    }
  }

  private async doesMailServiceExist(
    seviceType: MailServiceType,
  ): Promise<boolean> {
    const mailService = await MailServiceModel.findOne({
      where: { serviceType: seviceType },
    });
    return mailService !== null;
  }

  // will create if they don't already exist
  async createMailServices(): Promise<number> {
    let numCreated = 0;

    if (
      !(await this.doesMailServiceExist(MailServiceType.ASYNC_QUESTION_FLAGGED))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.PROFESSOR,
        serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
        name: 'Notify when a new anytime question is flagged as needing attention',
      });
    }

    if (
      !(await this.doesMailServiceExist(MailServiceType.WEEKLY_COURSE_SUMMARY))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.PROFESSOR,
        serviceType: MailServiceType.WEEKLY_COURSE_SUMMARY,
        name: 'Weekly Course Summary',
      });
    }

    if (
      !(await this.doesMailServiceExist(MailServiceType.COURSE_CLONE_SUMMARY))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.PROFESSOR,
        serviceType: MailServiceType.COURSE_CLONE_SUMMARY,
        name: 'Course Clone Summary',
      });
    }

    if (
      !(await this.doesMailServiceExist(
        MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
      ))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
        name: 'Notify when your anytime question has been answered by faculty',
      });
    }

    if (
      !(await this.doesMailServiceExist(
        MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
      ))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
        name: 'Notify when the status of your anytime question has changed',
      });
    }

    if (
      !(await this.doesMailServiceExist(MailServiceType.ASYNC_QUESTION_UPVOTED))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_UPVOTED,
        name: 'Notify when your anytime question has been upvoted',
      });
    }

    if (
      !(await this.doesMailServiceExist(
        MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST,
      ))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST,
        name: 'Notify when someone comments on your anytime question',
      });
    }

    if (
      !(await this.doesMailServiceExist(
        MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
      ))
    ) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
        name: 'Notify when someone comments on an anytime question you commented on',
      });
    }

    if (!(await this.doesMailServiceExist(MailServiceType.ADMIN_NOTICE))) {
      numCreated++;
      await this.factoryService.mailServiceFactory.create({
        mailType: OrganizationRole.MEMBER,
        serviceType: MailServiceType.ADMIN_NOTICE,
        name: 'Admin Notices',
      });
    }

    return numCreated;
  }

  /**
   * Returns the absolute path to the dev backup file.
   */
  private getDevBackupPath(): string {
    // process.cwd() is packages/server. Go up two levels to reach the repo root
    return path.resolve(process.cwd(), '../../backups', DEV_BACKUP_FILENAME);
  }

  /**
   * Exports (creates) a dev database backup.
   * Delegates to BackupService.exportDatabaseBackup().
   */
  async exportBackup(): Promise<string> {
    return this.backupService.exportDatabaseBackup(this.getDevBackupPath());
  }

  /**
   * Loads (restores) a dev database backup.
   * Delegates to BackupService.restoreDatabaseBackup().
   */
  async loadBackup(): Promise<string> {
    return this.backupService.restoreDatabaseBackup(
      this.getDevBackupPath(),
      DEV_DATABASES_TO_DROP,
    );
  }

  /**
   * Creates a backup, runs migration:generate with the given name, then restores the backup.
   * This automates the manual process described in NEWDEVS_STARTHERE.md.
   */
  async runMigrationWithBackup(migrationName: string): Promise<string> {
    const results: string[] = [];

    // Step 1: Create backup
    Logger.log('Step 1/3: Creating backup before migration...', 'SeedService');
    const exportResult = await this.exportBackup();
    results.push(`✅ ${exportResult}`);

    // Step 2: Run migration:generate
    Logger.log(
      `Step 2/3: Running migration:generate for "${migrationName}"...`,
      'SeedService',
    );
    try {
      const migrationCommand = `yarn migration:generate ./migration/${migrationName}`;
      // Run from the server package directory
      const serverDir = path.resolve(__dirname, '../..');
      const { stdout, stderr } = await execPromise(migrationCommand, {
        cwd: serverDir,
        timeout: LONG_TIMEOUT_MS,
      });
      Logger.log(`Migration output: ${stdout}`, 'SeedService');
      if (stderr) {
        Logger.warn(`Migration stderr: ${stderr}`, 'SeedService');
      }
      results.push(`✅ Migration "${migrationName}" generated successfully`);
    } catch (error) {
      results.push(`❌ Migration failed: ${error.message}`);
      Logger.error(`Migration failed: ${error.message}`, 'SeedService');
      // Still try to restore the backup even if migration fails
    }

    // Step 3: Restore backup
    Logger.log('Step 3/3: Restoring backup after migration...', 'SeedService');
    try {
      const loadResult = await this.loadBackup();
      results.push(`✅ ${loadResult}`);
    } catch (error) {
      results.push(`❌ Backup restore failed: ${error.message}`);
      Logger.error(`Backup restore failed: ${error.message}`, 'SeedService');
    }

    return results.join('\n');
  }
}
