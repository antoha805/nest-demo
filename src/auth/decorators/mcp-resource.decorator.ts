import { SetMetadata } from '@nestjs/common';

export const IS_MCP_RESOURCE_KEY = 'isMcpResource';

// Takes the tokens OAuth issues to MCP clients, instead of those of
// POST /api/auth/login, which every other route takes.
export const McpResource = () => SetMetadata(IS_MCP_RESOURCE_KEY, true);
