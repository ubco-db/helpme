/// <reference path="./markdown.d.ts" />
import * as fs from 'fs';
// Node.js require hook to load .md files as strings when using ts-node for the CLI
if (typeof require !== 'undefined' && require.extensions) {
  // @ts-ignore - require.extensions is deprecated but required for ts-node to handle .md files
  require.extensions['.md'] = (module: any, filename: string) => {
    module.exports = fs.readFileSync(filename, 'utf8');
  };
}
import { NestFactory } from '@nestjs/core';
import { CommandModule, CommandService } from 'nestjs-command';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false, // no logger
  });

  try {
    await app.select(CommandModule).get(CommandService).exec();
    await app.close();
  } catch (error) {
    console.error(error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
