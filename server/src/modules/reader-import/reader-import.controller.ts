import { BadRequestException, Controller, Post, Query, Req } from '@nestjs/common';
import { AuditAction, AuditResource, Permission } from '@bookorbit/types';

import { Auditable } from '../../common/decorators/auditable.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ForbidPermission } from '../../common/decorators/forbid-permission.decorator';
import type { MultipartRequest } from '../../common/types/multipart-request';
import type { RequestUser } from '../../common/types/request-user';
import { ImportReaderBackupDto } from './dto/import-reader-backup.dto';
import { ReaderImportService } from './reader-import.service';

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

@Controller('reader-import')
export class ReaderImportController {
  constructor(private readonly readerImportService: ReaderImportService) {}

  @Post('mihon')
  @ForbidPermission(Permission.DemoRestricted, 'Demo-restricted account cannot perform bulk edits')
  @Auditable({
    action: AuditAction.BookBulkSetStatus,
    resource: AuditResource.Book,
    description: (req) => `Import reading state from a Mihon backup (apply=${(req.query as { apply?: string })?.apply ?? 'false'})`,
  })
  async importMihon(@CurrentUser() user: RequestUser, @Req() req: MultipartRequest, @Query() dto: ImportReaderBackupDto) {
    let buffer: Buffer;
    try {
      const data = await req.file({ limits: { fileSize: MAX_BACKUP_BYTES } });
      if (!data) throw new BadRequestException('No file provided');
      buffer = await data.toBuffer();
    } catch (error) {
      if ((error as { code?: unknown })?.code === 'FST_REQ_FILE_TOO_LARGE') throw new BadRequestException('Backup exceeds 50 MB limit');
      throw error;
    }
    return this.readerImportService.importMihonBackup(user, buffer, dto.apply === true);
  }
}
