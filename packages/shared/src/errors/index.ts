export enum ErrorCode {
  ValidationError = 'VALIDATION_ERROR', NotFound = 'NOT_FOUND', Conflict = 'CONFLICT',
  TagIsolationViolation = 'TAG_ISOLATION_VIOLATION', InvalidState = 'INVALID_STATE',
  ImportFailed = 'IMPORT_FAILED', StorageError = 'STORAGE_ERROR', InternalError = 'INTERNAL_ERROR',
}
export interface AppErrorJSON {
  code: ErrorCode;
  message: string;
  details: unknown;
  statusCode: number;
}
const statusCodes: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400, NOT_FOUND: 404, CONFLICT: 409, TAG_ISOLATION_VIOLATION: 400,
  INVALID_STATE: 409, IMPORT_FAILED: 400, STORAGE_ERROR: 500, INTERNAL_ERROR: 500,
};
export class AppError extends Error {
  readonly statusCode: number;
  constructor(readonly code: ErrorCode, message: string, readonly details: unknown = null,
    statusCode: number = statusCodes[code]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
  toJSON(): AppErrorJSON {
    return { code: this.code, message: this.message, details: this.details, statusCode: this.statusCode };
  }
}
