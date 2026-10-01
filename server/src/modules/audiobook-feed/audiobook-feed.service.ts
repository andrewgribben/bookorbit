import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { basename } from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isAudioFormat } from '@bookorbit/types';
import type { FastifyReply } from 'fastify';

import type { RequestUser } from '../../common/types/request-user';
import { compareAudioTracks } from '../../common/utils/book-media.utils';
import { imageContentTypeFromPath } from '../../common/image-content-type';
import { BookCoverStore } from '../book-cover-store/book-cover-store.service';
import { BookService } from '../book/book.service';
import { LibraryService } from '../library/library.service';
import { AUDIO_MIME_TYPES, NOINDEX_ROBOTS_HEADER } from './audiobook-feed.constants';
import { buildAudiobookPodcastRss } from './audiobook-feed-rss';
import { AudiobookFeedRepository } from './audiobook-feed.repository';

@Injectable()
export class AudiobookFeedService {
  constructor(
    private readonly repo: AudiobookFeedRepository,
    private readonly bookService: BookService,
    private readonly libraryService: LibraryService,
    private readonly coverStore: BookCoverStore,
    private readonly config: ConfigService,
  ) {}

  async listCatalog(user: RequestUser, query: { q?: string; limit?: number; offset?: number }) {
    const libraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const { rows, total } = await this.repo.listCatalog(libraryIds, query.q, limit, offset);
    const authors = await this.repo.findAuthorsByBookIds(rows.map((row) => row.bookId));
    const authorsByBook = new Map<number, string[]>();
    for (const author of authors) {
      const list = authorsByBook.get(author.bookId) ?? [];
      list.push(author.name);
      authorsByBook.set(author.bookId, list);
    }

    return {
      total,
      items: rows.map((row) => {
        const enabled = row.feedEnabled === true;
        const publicId = enabled ? row.feedPublicId : null;
        return {
          bookId: row.bookId,
          libraryId: row.libraryId,
          title: row.title?.trim() || basename(row.folderPath),
          authors: authorsByBook.get(row.bookId) ?? [],
          feedEnabled: enabled,
          publicId,
          feedUrl: publicId ? this.feedUrl(publicId) : null,
        };
      }),
    };
  }

  async setFeedEnabled(bookId: number, enabled: boolean, user: RequestUser) {
    await this.bookService.verifyBookAccess(bookId, user);
    const files = (await this.repo.findAudioContentFiles(bookId)).filter((file) => file.format && isAudioFormat(file.format));
    if (files.length === 0) {
      throw new BadRequestException('Book has no audiobook content files');
    }

    if (enabled) {
      const row = await this.repo.upsertEnabled(bookId, user.id);
      return {
        bookId,
        feedEnabled: true,
        publicId: row.publicId,
        feedUrl: this.feedUrl(row.publicId),
      };
    }

    const row = await this.repo.setEnabled(bookId, false);
    if (!row) {
      return { bookId, feedEnabled: false, publicId: null, feedUrl: null };
    }
    return { bookId, feedEnabled: false, publicId: null, feedUrl: null };
  }

  async writeRss(publicId: string, reply: FastifyReply): Promise<void> {
    const feed = await this.requireEnabledFeed(publicId);
    const summary = await this.repo.findBookSummary(feed.bookId);
    if (!summary) throw new NotFoundException('Feed not found');

    const [authorRows, files] = await Promise.all([this.repo.findAuthorsByBookIds([feed.bookId]), this.repo.findAudioContentFiles(feed.bookId)]);
    const audioFiles = files.filter((file) => file.format && isAudioFormat(file.format)).sort(compareAudioTracks);
    if (audioFiles.length === 0) throw new NotFoundException('Feed not found');

    const title = summary.title?.trim() || basename(summary.folderPath);
    const author = authorRows.map((row) => row.name).join(', ') || 'Unknown author';
    const description = summary.description?.trim() || title;
    const link = this.feedUrl(feed.publicId);
    const coverUrl = this.coverUrl(feed.publicId);

    const xml = buildAudiobookPodcastRss({
      title,
      description,
      author,
      link,
      imageUrl: coverUrl,
      items: audioFiles.map((file) => {
        const fileTitle = audioFiles.length === 1 ? title : `${title} — ${basename(file.absolutePath)}`;
        return {
          title: fileTitle,
          description,
          guid: file.publicId,
          pubDate: file.createdAt ?? summary.addedAt,
          durationSeconds: file.durationSeconds,
          enclosureUrl: this.itemUrl(feed.publicId, file.publicId),
          enclosureType: AUDIO_MIME_TYPES[file.format!.toLowerCase()] ?? 'application/octet-stream',
          enclosureLength: file.sizeBytes ?? 0,
        };
      }),
    });

    this.applyNoIndex(reply);
    reply.header('Content-Type', 'application/rss+xml; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=300');
    reply.send(xml);
  }

  async streamItem(publicId: string, filePublicId: string, rangeHeader: string | undefined, reply: FastifyReply): Promise<void> {
    const feed = await this.requireEnabledFeed(publicId);
    const file = await this.repo.findAudioContentFile(feed.bookId, filePublicId);
    if (!file?.format || !isAudioFormat(file.format)) throw new NotFoundException('Feed item not found');

    const size = file.sizeBytes ?? (await stat(file.absolutePath)).size;
    const mimeType = AUDIO_MIME_TYPES[file.format.toLowerCase()] ?? 'application/octet-stream';
    this.applyNoIndex(reply);
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Cache-Control', 'public, max-age=86400');
    reply.type(mimeType);

    if (rangeHeader) {
      const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
      if (match) {
        const start = Number.parseInt(match[1]!, 10);
        const end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
        if (start >= size || end < start || end >= size) {
          reply.status(416).header('Content-Range', `bytes */${size}`).send();
          return;
        }
        reply.status(206);
        reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
        reply.header('Content-Length', end - start + 1);
        reply.send(createReadStream(file.absolutePath, { start, end }));
        return;
      }
    }

    reply.header('Content-Length', size);
    reply.send(createReadStream(file.absolutePath));
  }

  async streamCover(publicId: string, reply: FastifyReply): Promise<void> {
    const feed = await this.requireEnabledFeed(publicId);
    const coverPath = await this.coverStore.resolve(feed.bookId, { medium: 'audio', variant: 'cover' });
    if (!coverPath) throw new NotFoundException('Cover not found');
    const { size } = await stat(coverPath);
    this.applyNoIndex(reply);
    reply.header('Cache-Control', 'public, max-age=86400');
    reply.header('Content-Length', size);
    reply.type(imageContentTypeFromPath(coverPath));
    reply.send(createReadStream(coverPath));
  }

  private async requireEnabledFeed(publicId: string) {
    const [feed] = await this.repo.findByPublicId(publicId);
    if (!feed || !feed.enabled) throw new NotFoundException('Feed not found');
    return feed;
  }

  private applyNoIndex(reply: FastifyReply): void {
    reply.header('X-Robots-Tag', NOINDEX_ROBOTS_HEADER);
  }

  private publicBaseUrl(): string {
    const configured = this.config.get<string>('app.appUrl');
    if (configured && configured.trim()) return configured.replace(/\/+$/, '');
    return '';
  }

  private feedUrl(publicId: string): string {
    const base = this.publicBaseUrl();
    const path = `/api/v1/feeds/${publicId}`;
    return base ? `${base}${path}` : path;
  }

  private itemUrl(publicId: string, filePublicId: string): string {
    const base = this.publicBaseUrl();
    const path = `/api/v1/feeds/${publicId}/items/${filePublicId}`;
    return base ? `${base}${path}` : path;
  }

  private coverUrl(publicId: string): string {
    const base = this.publicBaseUrl();
    const path = `/api/v1/feeds/${publicId}/cover`;
    return base ? `${base}${path}` : path;
  }
}
