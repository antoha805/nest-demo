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
import { Public } from '../auth/decorators/public.decorator';
import { McpServerFactory } from './mcp-server.factory';

// The MCP endpoint, over Streamable HTTP. Public, as anyone can read: with a
// token the tools act as its user, and the writing tools need one.
@Public()
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpServerFactory: McpServerFactory) {}

  // Stateless: each request gets its own server and transport, so nothing is
  // kept between requests and any instance can answer. Responses are plain
  // JSON rather than an SSE stream, as no tool sends progress.
  @Post()
  async handle(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    // The guard ignores a bad token on public routes, but here that would
    // quietly turn a client whose token expired into an anonymous one.
    if (request.headers.authorization && !request.user) {
      response.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw new UnauthorizedException('The token is invalid or expired');
    }

    const server = this.mcpServerFactory.create(request.user);
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
