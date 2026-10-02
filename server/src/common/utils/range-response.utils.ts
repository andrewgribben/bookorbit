import { createReadStream } from 'fs';
import type { FastifyReply } from 'fastify';

/**
 * Streams a file with single-range support.
 *
 * Shared so the native file routes and the Komga-compatible file route cannot drift apart: a
 * client that resumes a download must get the same 206/416 behaviour from both.
 */
export function sendFileWithRange(reply: FastifyReply, absolutePath: string, size: number, rangeHeader: string | undefined): void {
  reply.header('Accept-Ranges', 'bytes');

  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : size - 1;
      if (start >= size || end < start || end >= size) {
        reply.status(416);
        reply.header('Content-Range', `bytes */${size}`);
        reply.send();
        return;
      }
      reply.status(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
      reply.header('Content-Length', end - start + 1);
      reply.send(createReadStream(absolutePath, { start, end }));
      return;
    }
  }

  reply.header('Content-Length', size);
  reply.send(createReadStream(absolutePath));
}
