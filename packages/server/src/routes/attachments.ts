import { Hono } from 'hono';
import { AppError, ErrorCode } from '@quarry/shared';
import type { QuarryServerEnv } from '../app.js';
import { AttachmentService, LocalAttachmentStorage } from '../services/attachment.service.js';
import { invalid } from '../services/common.js';

function service(c: import('hono').Context<QuarryServerEnv>) {
  const directory = c.get('attachmentsDir');
  const storage = c.get('attachmentStorage') ?? (directory ? new LocalAttachmentStorage(directory) : undefined);
  if (!storage) throw new AppError(ErrorCode.StorageError, 'Attachment storage is not configured');
  return new AttachmentService(c.get('repositories').attachments, storage);
}
export function createAttachmentRoutes() {
  return new Hono<QuarryServerEnv>()
    .post('/', async c => {
      let form: FormData;
      try { form = await c.req.formData(); } catch { return invalid('Expected multipart form data'); }
      const file = form.get('file');
      if (!file || typeof file === 'string') return invalid('A file field is required');
      const data = await service(c).upload(file);
      return c.json({ success: true, data: { ...data, url: `/api/attachments/${data.id}` } }, 201);
    })
    .get('/:id', async c => {
      const { attachment, stream } = await service(c).read(c.req.param('id'));
      return new Response(stream, { headers: { 'Content-Type': attachment.mime_type,
        'Content-Length': String(attachment.file_size), 'X-Content-Type-Options': 'nosniff' } });
    });
}
