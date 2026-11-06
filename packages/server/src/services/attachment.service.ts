import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, open, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IAttachmentRepository } from '@quarry/database';
import { AppError, ErrorCode } from '@quarry/shared';
import { found } from './common.js';

export interface IAttachmentStorage {
  upload(hash: string, content: Uint8Array): Promise<void>;
  readStream(hash: string): Promise<ReadableStream<Uint8Array>>;
  delete(hash: string): Promise<void>;
  exists(hash: string): Promise<boolean>;
}
function missing(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === 'ENOENT'; }
export class LocalAttachmentStorage implements IAttachmentStorage {
  constructor(private readonly directory: string) {}
  private path(hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new AppError(ErrorCode.StorageError, 'Invalid attachment hash');
    return join(this.directory, hash);
  }
  async upload(hash: string, content: Uint8Array) {
    await mkdir(this.directory, { recursive: true });
    const destination = this.path(hash);
    const temporary = join(this.directory, `${hash}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, content, { flag: 'wx' });
      try { await link(temporary, destination); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    } finally {
      try { await unlink(temporary); } catch (error) { if (!missing(error)) throw error; }
    }
  }
  async readStream(hash: string) {
    // Open before returning the response so missing files produce a JSON 404.
    const handle = await open(this.path(hash), 'r');
    return Readable.toWeb(handle.createReadStream()) as ReadableStream<Uint8Array>;
  }
  async delete(hash: string) {
    try { await unlink(this.path(hash)); } catch (error) { if (!missing(error)) throw error; }
  }
  async exists(hash: string) {
    try { return (await stat(this.path(hash))).isFile(); }
    catch (error) { if (missing(error)) return false; throw error; }
  }
}
export class AttachmentService {
  constructor(private readonly repository: IAttachmentRepository, private readonly storage: IAttachmentStorage) {}
  async upload(file: File) {
    const content = new Uint8Array(await file.arrayBuffer());
    const hash = createHash('sha256').update(content).digest('hex');
    await this.storage.upload(hash, content);
    const existing = await this.repository.findBySha256(hash);
    if (existing) return existing;
    try {
      return await this.repository.create({ id: randomUUID(), sha256: hash, filename: file.name,
        mime_type: file.type || 'application/octet-stream', file_size: content.byteLength });
    } catch (error) {
      // Another concurrent upload may have inserted the same unique hash.
      const duplicate = await this.repository.findBySha256(hash);
      if (duplicate) return duplicate;
      throw error;
    }
  }
  async read(id: string) {
    const attachment = found(await this.repository.findById(id));
    try { return { attachment, stream: await this.storage.readStream(attachment.sha256) }; }
    catch (error) {
      if (missing(error)) throw new AppError(ErrorCode.NotFound, 'Attachment file not found');
      throw error;
    }
  }
}
