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
import LtiMiddleware from './lti/lti.middleware';

export async function bootstrap(hot: any): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks(); // So we can clean up SSE.
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

  addGlobalsToApp(app);
  app.setGlobalPrefix('api/v1');

  app.use(morgan('dev'));
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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

  // Setup LTIJS as a middleware to listen at /api/v1/lti
  await LtiMiddleware.enable(app, '/api/v1/lti');

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
export function addGlobalsToApp(app: INestApplication, test = false): void {
  if (!test) {
    app.use(/\/api\/v1(?!\/lti)/, (req, res, next) => {
      console.log('regular middleware used');
      next();
    });
    app.use(/\/api\/v1\/lti/, (req, res, next) => {
      console.log('lti middleware used');
      next();
    });
    // If not an LTI route, use standard helmet, cookieParser
    // Regex: (?!\/lti) means NOT /lti, avoids using these middlewares at (/api/v1)/lti routes
    app.use(/\/api\/v1(?!\/lti)/, cookieParser());
    app.use(/\/api\/v1(?!\/lti)/, helmet());
    // If an LTI route, use customized helmet, cookieParser
    app.use(
      /\/api\/v1\/lti/,
      helmet({
        frameguard: false,
        contentSecurityPolicy: false,
      }),
    );
    app.use(/\/api\/v1\/lti/, cookieParser(process.env.LTI_SECRET_KEY));
  } else {
    app.use(/(?!\/lti)/, cookieParser());
    app.use(/(?!\/lti)/, helmet());
    // If an LTI route, use customized helmet, cookieParser
    app.use(
      /\/lti/,
      helmet({
        frameguard: false,
        contentSecurityPolicy: false,
      }),
    );
    app.use(/\/lti/, cookieParser(process.env.LTI_SECRET_KEY));
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalPipes(new StripUndefinedPipe());
}
