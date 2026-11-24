import { Hono } from 'hono';
import { AppError, ErrorCode } from '@quarry/shared';
import type { QuarryServerEnv } from '../app.js';
import type { IAttachmentRepository } from '@quarry/database';
import { AttachmentService, LocalAttachmentStorage } from '../services/attachment.service.js';
import { invalid } from '../services/common.js';

function service(c: import('hono').Context<QuarryServerEnv>, repository: IAttachmentRepository) {
  const directory = c.get('attachmentsDir');
  const storage = c.get('attachmentStorage') ?? (directory ? new LocalAttachmentStorage(directory) : undefined);
  if (!storage) throw new AppError(ErrorCode.StorageError, 'Attachment storage is not configured');
  return new AttachmentService(repository, storage);
}
export function createAttachmentRoutes() {
  return new Hono<QuarryServerEnv>()
    .post('/', async c => {
      let form: FormData;
      try { form = await c.req.formData(); } catch { return invalid('Expected multipart form data'); }
      const file = form.get('file');
      if (!file || typeof file === 'string') return invalid('A file field is required');
      // Share the import transaction queue so a rollback cannot remove a blob being uploaded separately.
      const data = await c.get('withTransaction')(repositories => service(c, repositories.attachments).upload(file));
      return c.json({ success: true, data: { ...data, url: `/api/attachments/${data.id}` } }, 201);
    })
    .get('/:id', async c => {
      const { attachment, stream } = await service(c, c.get('repositories').attachments).read(c.req.param('id'));
      return new Response(stream, { headers: { 'Content-Type': attachment.mime_type,
        'Content-Length': String(attachment.file_size), 'X-Content-Type-Options': 'nosniff' } });
    });
}
