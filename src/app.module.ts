import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CommentsModule } from './comments/comments.module';
import { DriverExceptionFilter } from './common/filters/driver-exception.filter';
import { NotFoundErrorFilter } from './common/filters/not-found-error.filter';
import { EnvironmentVariables, validate } from './config/env.validation';
import { buildLogTransport } from './config/log-transports';
import { createOrmConfig } from './database/mikro-orm.config';
import { NotificationsModule } from './notifications/notifications.module';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: () => randomUUID(),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          transport: buildLogTransport(
            config.get('LOG_TRANSPORTS', { infer: true }),
            config.get('LOG_LEVEL', { infer: true }),
          ),
        },
      }),
    }),
    MikroOrmModule.forRootAsync({
      driver: PostgreSqlDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        createOrmConfig({
          DB_HOST: config.get('DB_HOST', { infer: true }),
          DB_PORT: config.get('DB_PORT', { infer: true }),
          DB_USERNAME: config.get('DB_USERNAME', { infer: true }),
          DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
          DB_NAME: config.get('DB_NAME', { infer: true }),
        }),
    }),
    AuthModule,
    CategoriesModule,
    PostsModule,
    CommentsModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: DriverExceptionFilter },
    { provide: APP_FILTER, useClass: NotFoundErrorFilter },
  ],
})
export class AppModule {}
