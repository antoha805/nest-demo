import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

const PG_NOT_NULL_VIOLATION = '23502';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_UNIQUE_VIOLATION = '23505';

@Catch(QueryFailedError)
export class QueryFailedFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    super.catch(this.toHttpException(exception) ?? exception, host);
  }

  private toHttpException(exception: QueryFailedError): HttpException | null {
    const { code } = exception.driverError as { code?: string };

    switch (code) {
      case PG_NOT_NULL_VIOLATION:
        return new BadRequestException('A required field cannot be null');
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
