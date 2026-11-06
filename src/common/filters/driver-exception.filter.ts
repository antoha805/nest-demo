import { DriverException } from '@mikro-orm/core';
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

const PG_RESTRICT_VIOLATION = '23001';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_UNIQUE_VIOLATION = '23505';

@Catch(DriverException)
export class DriverExceptionFilter extends BaseExceptionFilter {
  catch(exception: DriverException, host: ArgumentsHost) {
    super.catch(this.toHttpException(exception) ?? exception, host);
  }

  private toHttpException(exception: DriverException): HttpException | null {
    switch (exception.code) {
      case PG_NOT_NULL_VIOLATION:
        return new BadRequestException('A required field cannot be null');
      case PG_RESTRICT_VIOLATION:
      case PG_FOREIGN_KEY_VIOLATION:
        return new ConflictException(
          'The record is referenced by other records',
        );
      case PG_UNIQUE_VIOLATION:
        return new ConflictException('A record with this value already exists');
      default:
        return null;
    }
  }
}
