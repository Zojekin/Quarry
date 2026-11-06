import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ISnapshotRepository } from '@quarry/database';
import type { QuarryServerEnv } from '../app.js';
import { BackupService } from '../services/backup.service.js';
import { LocalAttachmentStorage } from '../services/attachment.service.js';
import { body, invalid } from '../services/common.js';

export function createBackupImportRoutes(snapshots: ISnapshotRepository, recoveryPointsDir?: string) {
  const routes = new Hono<QuarryServerEnv>();
  const service = (c: Context<QuarryServerEnv>) => new BackupService(
    c.get('repositories'), c.get('withTransaction'), snapshots,
    c.get('attachmentStorage') ?? (c.get('attachmentsDir') ? new LocalAttachmentStorage(c.get('attachmentsDir')!) : undefined),
    recoveryPointsDir);
  async function importRequest(c: Context<QuarryServerEnv>, commit: boolean) {
    if (c.req.header('content-type')?.includes('multipart/form-data')) {
      const form = await c.req.formData(); const file = form.get('file');
      if (!(file instanceof File)) invalid('Expected file');
      const format = String(form.get('format') ?? file.name.split('.').pop());
      if (format === 'quarry') return service(c).importArchive(new Uint8Array(await file.arrayBuffer()), commit);
      return commit ? service(c).commit(await file.text(), format) : service(c).preview(await file.text(), format);
    }
    const input = await body(c);
    if (typeof input.content !== 'string' || typeof input.format !== 'string') invalid('Expected content and format');
    return commit ? service(c).commit(input.content, input.format) : service(c).preview(input.content, input.format);
  }
  return routes
    .post('/import/preview', async c => c.json({ success: true, data: await importRequest(c, false) }))
    .post('/import/commit', async c => c.json({ success: true, data: await importRequest(c, true) }, 201))
    .get('/export/:entity/:id', async c => {
      const result = await service(c).export(c.req.param('entity'), c.req.param('id'), c.req.query('format') ?? 'json');
      return new Response(Buffer.from(result.bytes), { headers: { 'Content-Type': result.mime,
        'Content-Disposition': `attachment; filename="export.${result.extension}"` } });
    })
    .post('/backup/create', async c => new Response(Buffer.from(await service(c).create()), { headers: {
      'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="quarry.quarry-backup"',
    } }))
    .post('/backup/restore', async c => {
      let bytes: Uint8Array;
      if (c.req.header('content-type')?.includes('multipart/form-data')) {
        const file = (await c.req.formData()).get('file');
        if (!(file instanceof File)) invalid('Expected backup file');
        bytes = new Uint8Array(await file.arrayBuffer());
      } else bytes = new Uint8Array(await c.req.arrayBuffer());
      return c.json({ success: true, data: await service(c).restore(bytes) });
    });
}

