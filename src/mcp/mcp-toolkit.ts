import { NotFoundError } from '@mikro-orm/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  Type,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PolicyHandler } from '../casl/check-policies.decorator';

// What a tool does, for clients deciding whether to ask the user first.
// Writes that are not destructive have to say so, as MCP assumes they are.
export const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
export const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const;
export const IDEMPOTENT_WRITE = { ...WRITE, idempotentHint: true } as const;
export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
} as const;

// The same checks as the REST routes, in the same order: the token, the
// permission, then the input, which is validated by the same DTOs.
@Injectable()
export class McpToolkit {
  private readonly logger = new Logger(McpToolkit.name);
  private readonly validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  constructor(private readonly caslAbilityFactory: CaslAbilityFactory) {}

  requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException(
        'This tool needs you to be logged in: send a bearer token',
      );
    }
    return user;
  }

  // Like @CheckPolicies, for the permissions that apply to every record.
  authorize(
    user: AuthenticatedUser | undefined,
    check: PolicyHandler,
  ): AuthenticatedUser {
    const current = this.requireUser(user);
    this.assertAllowed(check(this.caslAbilityFactory.createForUser(current)));
    return current;
  }

  // For checks that depend on the record, such as PostsService.can.
  assertAllowed(allowed: boolean): void {
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to do this');
    }
  }

  validate<T extends object>(dto: Type<T>, input: object): Promise<T> {
    return this.validationPipe.transform(input, {
      type: 'body',
      metatype: dto,
    }) as Promise<T>;
  }

  // Returns the result as JSON, or the message for actions that return
  // nothing, and errors as tool errors the model can read. Unexpected errors
  // are logged and not described, as the SDK would otherwise pass on their
  // message, such as a database error.
  async run(
    fn: () => Promise<unknown>,
    doneMessage = 'Done',
  ): Promise<CallToolResult> {
    try {
      const result = await fn();
      const text = result === undefined ? doneMessage : JSON.stringify(result);
      return { content: [{ type: 'text', text }] };
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        return toolError('The requested record was not found');
      }
      if (error instanceof HttpException) {
        return toolError(httpErrorMessage(error));
      }
      this.logger.error({ err: error }, 'An MCP tool failed');
      return toolError('Internal server error');
    }
  }
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// Validation errors list each problem in `message`, as REST responses do.
function httpErrorMessage(error: HttpException): string {
  const response = error.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  const { message } = response as { message?: string | string[] };
  if (Array.isArray(message)) {
    return message.join('; ');
  }
  return message ?? error.message;
}
