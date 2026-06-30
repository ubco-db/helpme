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
