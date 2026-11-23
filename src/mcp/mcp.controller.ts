import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/authenticated-user';
import { McpResource } from '../auth/decorators/mcp-resource.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { MCP_WRITE_SCOPE, OAuthUrls } from '../auth/oauth/oauth-urls';
import { McpServerFactory } from './mcp-server.factory';

// The MCP endpoint, over Streamable HTTP, for clients signed in with OAuth.
// Public to the guard only so that a missing token gets the 401 below, which
// tells clients where to sign in.
@Public()
@McpResource()
@Controller('mcp')
export class McpController {
  constructor(
    private readonly mcpServerFactory: McpServerFactory,
    private readonly urls: OAuthUrls,
  ) {}

  // Stateless: each request gets its own server and transport, so nothing is
  // kept between requests and any instance can answer. Responses are plain
  // JSON rather than an SSE stream, as no tool sends progress.
  @Post()
  async handle(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    // Points clients at the metadata that leads to the sign-in, per the MCP
    // authorization spec. A client whose token expired is told so, and
    // refreshes it.
    if (!request.user) {
      const metadata = `resource_metadata="${this.urls.protectedResourceMetadata}"`;
      response.setHeader(
        'WWW-Authenticate',
        request.headers.authorization
          ? `Bearer error="invalid_token", ${metadata}`
          : `Bearer ${metadata}`,
      );
      throw new UnauthorizedException(
        request.headers.authorization
          ? 'The token is invalid or expired'
          : 'Sign in with OAuth to use the MCP server',
      );
    }

    const server = this.mcpServerFactory.create(request.user, {
      canWrite: request.tokenScopes?.includes(MCP_WRITE_SCOPE) ?? false,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }

  // Without sessions there is no stream to open with GET nor session to end
  // with DELETE.
  // Separate handlers, as a method takes only one route decorator.
  @Get()
  @HttpCode(HttpStatus.METHOD_NOT_ALLOWED)
  @Header('Allow', 'POST')
  get() {
    return METHOD_NOT_ALLOWED;
  }

  @Delete()
  @HttpCode(HttpStatus.METHOD_NOT_ALLOWED)
  @Header('Allow', 'POST')
  delete() {
    return METHOD_NOT_ALLOWED;
  }
}

const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed' },
  id: null,
};
