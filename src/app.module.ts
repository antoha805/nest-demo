import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';
import { CategoriesModule } from './categories/categories.module';
import { EntityNotFoundFilter } from './common/filters/entity-not-found.filter';
import { QueryFailedFilter } from './common/filters/query-failed.filter';
import { EnvironmentVariables, validate } from './config/env.validation';
import { buildLogTransport } from './config/log-transports';
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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres',
        host: config.get('DB_HOST', { infer: true }),
        port: config.get('DB_PORT', { infer: true }),
        username: config.get('DB_USERNAME', { infer: true }),
        password: config.get('DB_PASSWORD', { infer: true }),
        database: config.get('DB_NAME', { infer: true }),
        autoLoadEntities: true,
      }),
    }),
    CategoriesModule,
    PostsModule,
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
    { provide: APP_FILTER, useClass: QueryFailedFilter },
    { provide: APP_FILTER, useClass: EntityNotFoundFilter },
  ],
})
export class AppModule {}
