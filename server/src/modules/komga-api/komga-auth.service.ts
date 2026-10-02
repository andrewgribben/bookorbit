import { Injectable } from '@nestjs/common';
import { compare } from 'bcryptjs';

import { DUMMY_HASH } from '../auth/auth.service';
import { UserService } from '../user/user.service';

@Injectable()
export class KomgaAuthService {
  constructor(private readonly userService: UserService) {}

  /** Rejects locked, inactive, or default-password accounts. Failed attempts do not count toward lockout. */
  async validateBasicCredentials(username: string, password: string): Promise<number | null> {
    const user = await this.userService.findByUsername(username);
    const valid = await compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.active || !valid) return null;
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null;
    if (user.isDefaultPassword) return null;
    return user.id;
  }
}
