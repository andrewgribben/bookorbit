import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Public } from '../../common/decorators/public.decorator';

/** Stub endpoints that KMReader expects but are not part of the Komga API spec. */
@Controller('komga')
@Public()
export class KomgaFallbackController {
  @Get('sse/v1/events')
  events(@Res() reply: FastifyReply): void {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write(':keepalive\n\n');
    const interval = setInterval(() => reply.raw.write(':keepalive\n\n'), 30000);
    reply.raw.on('close', () => clearInterval(interval));
  }
}
