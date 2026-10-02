import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { RequestUser } from '../../common/types/request-user';
import { UserService } from '../user/user.service';
import { KomgaApiKeyService } from './komga-api-key.service';
import { KomgaAuthService } from './komga-auth.service';
import { KomgaSessionService } from './komga-session.service';

const BASIC_REALM = 'Basic realm="bookorbit komga"';
const SESSION_COOKIE = 'KOMGA-SESSION';

function readHeader(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export interface KomgaAuthenticatedRequest extends FastifyRequest {
  user?: RequestUser;
}

type AuthMethod = 'api_key' | 'session' | 'basic';

@Injectable()
export class KomgaAuthGuard implements CanActivate {
  constructor(
    private readonly authService: KomgaAuthService,
    private readonly apiKeyService: KomgaApiKeyService,
    private readonly sessionService: KomgaSessionService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<KomgaAuthenticatedRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const { userId, method } = await this.resolveUserId(request, reply);

    const user = await this.userService.findByIdWithPermissions(userId);
    if (!user || !user.active) {
      reply.header('WWW-Authenticate', BASIC_REALM);
      throw new UnauthorizedException('Account not found or disabled');
    }

    if (method === 'basic') {
      // KMReader expects both Set-Cookie and X-Auth-Token in the response after Basic auth.
      const token = this.sessionService.create(user.id);
      reply.header('Set-Cookie', `KOMGA-SESSION=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
      reply.header('X-Auth-Token', token);
    }

    request.user = user;
    return true;
  }

  private unauthorized(reply: FastifyReply, message: string): UnauthorizedException {
    reply.header('WWW-Authenticate', BASIC_REALM);
    return new UnauthorizedException(message);
  }

  private decodeBasic(raw: string): { username: string; password: string } | null {
    const decoded = Buffer.from(raw, 'base64').toString();
    const separator = decoded.indexOf(':');
    if (separator === -1) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  }

  private async resolveUserId(request: KomgaAuthenticatedRequest, reply: FastifyReply): Promise<{ userId: number; method: AuthMethod }> {
    const apiKey = readHeader(request.headers['x-api-key']);
    if (apiKey) {
      const apiKeyUserId = await this.apiKeyService.resolveUserId(apiKey);
      if (apiKeyUserId === null) throw this.unauthorized(reply, 'Invalid API key');
      return { userId: apiKeyUserId, method: 'api_key' };
    }

    // X-Auth-Token carries the same session token as the KOMGA-SESSION cookie.
    const xAuthToken = readHeader(request.headers['x-auth-token']);
    if (xAuthToken && this.sessionService.isValidToken(xAuthToken)) {
      const sessionUserId = this.sessionService.resolve(xAuthToken);
      if (sessionUserId !== null) return { userId: sessionUserId, method: 'session' };
    }

    const sessionCookie = request.cookies?.[SESSION_COOKIE];
    if (sessionCookie && this.sessionService.isValidToken(sessionCookie)) {
      const sessionUserId = this.sessionService.resolve(sessionCookie);
      if (sessionUserId !== null) return { userId: sessionUserId, method: 'session' };
    }

    // Accept X-Auth-Token with raw Base64 credentials as an alternative to Authorization: Basic.
    // KMReader sends the session token as X-Auth-Token when available, but some clients send
    // the Base64 credentials directly.
    if (xAuthToken) {
      const creds = this.decodeBasic(xAuthToken);
      if (creds) {
        const userId = await this.authService.validateBasicCredentials(creds.username, creds.password);
        if (userId !== null) return { userId, method: 'basic' };
      }
      throw this.unauthorized(reply, 'Invalid credentials');
    }

    const authorization = readHeader(request.headers.authorization);
    if (!authorization?.startsWith('Basic ')) {
      throw this.unauthorized(reply, 'Authentication required');
    }

    const creds = this.decodeBasic(authorization.slice('Basic '.length));
    if (!creds) throw this.unauthorized(reply, 'Invalid credentials');

    const userId = await this.authService.validateBasicCredentials(creds.username, creds.password);
    if (userId === null) throw this.unauthorized(reply, 'Invalid credentials');
    return { userId, method: 'basic' };
  }
}
