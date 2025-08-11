import { isProd } from '@koh/common';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as morgan from 'morgan';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';
import { StripUndefinedPipe } from './stripUndefined.pipe';
import * as expressSession from 'express-session';
import { ApplicationConfigService } from './config/application_config.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Chromiumly } from 'chromiumly';
import helmet from 'helmet';

export async function bootstrap(hot: any): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks(); // So we can clean up SSE.
  addGlobalsToApp(app);
  app.setGlobalPrefix('api/v1');

  const configService = app.get(ApplicationConfigService);
  await configService.loadConfig();

  if (isProd()) {
    console.log(`Running production at ${process.env.DOMAIN}.`);
  } else {
    console.log(
      `Running non-production at ${process.env.DOMAIN}. THIS MSG SHOULD NOT APPEAR ON PROD VM`,
    );
  }

  app.setGlobalPrefix('api/v1');
  app.use(morgan('dev'));
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.use(helmet());
  app.use(
    expressSession({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProd(), // Ensure cookies are sent over HTTPS in production
      },
    }),
  );

  app.enableCors({
    origin: '*',
    allowedHeaders: 'Content-Type, Accept',
  });

  // Chromiumly is used with the gotenberg docker service for pdf conversion
  Chromiumly.configure({ endpoint: 'http://localhost:3004' });

  app.set('trust proxy', 'loopback'); // Trust requests from the loopback address
  await app.listen(3002);

  if (hot) {
    hot.accept();
    hot.dispose(() => app.close());
  }
}

// Global settings that should be true in prod and in integration tests
export function addGlobalsToApp(app: INestApplication): void {
  app.useGlobalPipes(
    // Y'know all of our classes with decorators inside common/index.ts?
    // Those are known as DTOs and we put them on our endpoints,
    // and this ValidationPipe will validate the bodies so that whatever the frontend sends
    // will match the DTOs. This prevents the frontend from sending bad data to the backend (very very important).
    new ValidationPipe({
      // This will turn our DTOs into essentially a "whitelist", where any properties
      // that are in the object passed to the endpoint but are not inside the DTO are not allowed.
      // By default, this will DROP any properties that are not in the DTO (unless forbidNonWhitelisted is true).
      whitelist: true,
      // This controls whether or not we want to throw an error to the frontend if the body
      // has properties that are not in the DTO.
      // Having this false may result in some hidden errors, where you may try to pass something
      // to the backend just for it to mysteriously disappear.
      // But having this true may result in actual annoying errors for our users if for some reason
      // we were to mess up our frontend and call our backend with bad data.
      // So there's tradeoffs either way.
      forbidNonWhitelisted: false,
      // This will automatically transform the body to the DTO types.
      // Over HTTP, the whole body and properties are a string so this will automatically
      // transform them into numbers, booleans, other objects, etc.
      transform: true,
    }),
  );
  app.useGlobalPipes(new StripUndefinedPipe());
  app.use(cookieParser());
}
