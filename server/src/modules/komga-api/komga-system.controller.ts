import { Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Public } from '../../common/decorators/public.decorator';
import { KomgaAuthGuard, type KomgaAuthenticatedRequest } from './komga-auth.guard';
import { KomgaSessionService } from './komga-session.service';

@Controller('komga')
@Public()
export class KomgaSystemController {
  constructor(private readonly sessionService: KomgaSessionService) {}

  @Get('api/v1/claim')
  getClaimStatus(): { isClaimed: boolean } {
    return { isClaimed: true };
  }

  @Get('api/v1/client-settings/global/list')
  listGlobalSettings(): Record<string, never> {
    return {};
  }

  /** Komga answers both verbs with 204; the client only needs the session probe to end cleanly. */
  @UseGuards(KomgaAuthGuard)
  @Get('api/logout')
  @HttpCode(204)
  logout(): void {}

  @UseGuards(KomgaAuthGuard)
  @Post('api/logout')
  @HttpCode(204)
  logoutPost(): void {}

  @UseGuards(KomgaAuthGuard)
  @Get('api/v1/login/set-cookie')
  @HttpCode(204)
  setCookie(@Req() req: KomgaAuthenticatedRequest, @Res({ passthrough: true }) reply: FastifyReply): void {
    if (!req.user) throw new UnauthorizedException();
    const token = this.sessionService.create(req.user.id);
    reply.header('Set-Cookie', `KOMGA-SESSION=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
  }
}
