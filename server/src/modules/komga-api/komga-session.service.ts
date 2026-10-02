import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SessionEntry {
  userId: number;
  expiresAt: number;
}

@Injectable()
export class KomgaSessionService {
  private readonly sessions = new Map<string, SessionEntry>();

  create(userId: number): string {
    const token = randomUUID();
    this.sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
    return token;
  }

  resolve(token: string | undefined): number | null {
    if (!token) return null;
    const entry = this.sessions.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return entry.userId;
  }

  /** Session IDs are opaque UUIDs; a non-UUID value is not a valid session. */
  isValidToken(token: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  }
}
