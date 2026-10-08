import { redact } from '../logging/redact.js';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  let appError = error instanceof AppError ? error : undefined;
  if (
    !appError &&
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400
  ) {
    appError = new AppError(
      400,
      'INVALID_JSON',
      'Request body must be valid JSON',
    );
  }
  if (
    !appError &&
    error instanceof Error &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    appError = new AppError(
      413,
      'PAYLOAD_TOO_LARGE',
      'Request body exceeds the size limit',
    );
  }
  if (!appError || appError.statusCode >= 500) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'request_error',
        requestId: res.locals.requestId,
        message:
          error instanceof Error ? redact(error.message) : 'Unknown error',
        stack:
          error instanceof Error && error.stack
            ? redact(error.stack)
            : undefined,
      }),
    );
  }
  res.status(appError?.statusCode ?? 500).json({
    error: {
      code: appError?.code ?? 'INTERNAL_ERROR',
      message:
        appError && appError.statusCode < 500
          ? appError.message
          : 'Internal server error',
      requestId: res.locals.requestId,
    },
  });
};
