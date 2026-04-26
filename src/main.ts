import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger';

/** Time before `process.exit(1)` so async cleanup can finish. */
const SHUTDOWN_EXIT_DELAY_MS = 100;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const appLogger = app.get(AppLogger);
  app.useLogger(appLogger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  const port = process.env.PORT || 4000;
  registerProcessErrorHandlers(app, appLogger);

  await app.listen(port);
  appLogger.log(
    `Server running on http://localhost:${port}`,
    'Bootstrap',
  );
}

function registerProcessErrorHandlers(
  app: { close: () => Promise<unknown> },
  logger: AppLogger,
): void {
  let shuttingDown = false;
  const shutdown = async (
    reason: string,
    error: unknown,
    fatal = false,
  ): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    const stack =
      error instanceof Error ? error.stack : `${reason}: ${String(error)}`;
    if (fatal) {
      logger.fatal(`${reason}: ${formatError(error)}`, stack, 'Process');
    } else {
      logger.error(`${reason}: ${formatError(error)}`, stack, 'Process');
    }

    try {
      await app.close();
    } catch (closeError) {
      logger.error(
        `Failed to close Nest app: ${formatError(closeError)}`,
        closeError instanceof Error ? closeError.stack : undefined,
        'Process',
      );
    }
    setTimeout(() => process.exit(1), SHUTDOWN_EXIT_DELAY_MS).unref();
  };

  process.on('uncaughtException', (error) => {
    void shutdown('uncaughtException', error, true);
  });

  process.on('unhandledRejection', (reason) => {
    void shutdown('unhandledRejection', reason);
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

bootstrap();
