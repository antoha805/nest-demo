import { NotFoundError } from '@mikro-orm/core';
import { ArgumentsHost, Catch, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

// Thrown by findOneOrFail when no record matches.
@Catch(NotFoundError)
export class NotFoundErrorFilter extends BaseExceptionFilter {
  catch(_exception: NotFoundError, host: ArgumentsHost) {
    super.catch(
      new NotFoundException('The requested record was not found'),
      host,
    );
  }
}
