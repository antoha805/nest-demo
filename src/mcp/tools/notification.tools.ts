import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/authenticated-user';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination-query.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { IDEMPOTENT_WRITE, McpToolkit, READ_ONLY } from '../mcp-toolkit';

const notificationId = z.uuid().describe('The id of the notification.');

// Every tool is for the user's own notifications, so needs no permission.
@Injectable()
export class NotificationTools {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly toolkit: McpToolkit,
  ) {}

  register(server: McpServer, user?: AuthenticatedUser): void {
    const { toolkit, notificationsService } = this;

    server.registerTool(
      'list_notifications',
      {
        title: 'List your notifications',
        description:
          'Lists your notifications, newest first, such as likes and comments on ' +
          'your posts. For the next page, pass the nextCursor of the previous ' +
          'one as cursor. get_me has the unread count.',
        inputSchema: {
          cursor: z.uuid().optional(),
          limit: z
            .number()
            .int()
            .optional()
            .describe('Notifications per page, from 1 to 100. Defaults to 20.'),
        },
        annotations: READ_ONLY,
      },
      (args) =>
        toolkit.run(async () =>
          notificationsService.findAll(
            toolkit.requireUser(user).id,
            await toolkit.validate(CursorPaginationQueryDto, args),
          ),
        ),
    );

    server.registerTool(
      'mark_notification_read',
      {
        title: 'Mark a notification as read',
        inputSchema: { id: notificationId },
        annotations: IDEMPOTENT_WRITE,
      },
      ({ id }) =>
        toolkit.run(
          () =>
            notificationsService.markAsRead(id, toolkit.requireUser(user).id),
          'Marked as read',
        ),
    );

    server.registerTool(
      'mark_notification_unread',
      {
        title: 'Mark a notification as unread',
        inputSchema: { id: notificationId },
        annotations: IDEMPOTENT_WRITE,
      },
      ({ id }) =>
        toolkit.run(
          () =>
            notificationsService.markAsUnread(id, toolkit.requireUser(user).id),
          'Marked as unread',
        ),
    );

    server.registerTool(
      'mark_all_notifications_read',
      {
        title: 'Mark all notifications as read',
        annotations: IDEMPOTENT_WRITE,
      },
      () =>
        toolkit.run(
          () =>
            notificationsService.markAllAsRead(toolkit.requireUser(user).id),
          'All marked as read',
        ),
    );
  }
}
