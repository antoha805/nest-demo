import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Sse,
} from '@nestjs/common';
import {
  endWith,
  ignoreElements,
  interval,
  map,
  merge,
  Observable,
  share,
  takeUntil,
} from 'rxjs';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination-query.dto';
import { NotificationsService, StreamEvent } from './notifications.service';

// Proxies and load balancers close connections that stay quiet for long.
export const HEARTBEAT_INTERVAL_MS = 25_000;

function toMessageEvent(event: StreamEvent): MessageEvent {
  if (event.type === 'notification') {
    const { notification } = event;
    return { type: 'notification', id: notification.id, data: notification };
  }
  // Every event needs an id, or Nest numbers it, and a client reconnecting
  // with that number would miss the replay. This one resumes after the newest
  // notification, which the count includes. Empty while there is none.
  return {
    type: 'unread-count',
    id: event.newestId ?? '',
    data: { count: event.count },
  };
}

// Every route is for the user's own notifications, so needs no permission.
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @Query() query: CursorPaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.findAll(user.id, query);
  }

  // Each notification is a "notification" event whose id is the notification's.
  // A client reconnecting with Last-Event-ID first gets those it missed, then
  // an "unread-count" event, whose count the later notifications add to. It
  // has to send the token as a header, which EventSource cannot, so browsers
  // use a client such as @microsoft/fetch-event-source.
  @Sse('stream')
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('last-event-id') lastEventId?: string,
  ): Observable<MessageEvent> {
    const events = this.notificationsService
      .stream(user.id, lastEventId)
      .pipe(share());
    return merge(
      events.pipe(map(toMessageEvent)),
      // Stops with the notifications, such as on shutdown, so the stream ends.
      interval(HEARTBEAT_INTERVAL_MS).pipe(
        map((): MessageEvent => ({ comment: 'heartbeat' })),
        takeUntil(events.pipe(ignoreElements(), endWith(null))),
      ),
    );
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Delete(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsUnread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsUnread(id, user.id);
  }
}
