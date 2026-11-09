import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let errors: Record<string, string[]> | string = 'Internal server error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, any>;
      if (Array.isArray(resp.message)) {
        errors = { body: resp.message };
      } else if (resp.message) {
        errors = { body: [resp.message] };
      } else {
        errors = resp;
      }
    } else if (typeof exceptionResponse === 'string') {
      errors = { body: [exceptionResponse] };
    }

    if (status >= 500) {
      Logger.error(
        `[${status}] Internal server error: ${exception instanceof Error ? exception.stack : String(exception)}`,
        HttpExceptionFilter.name,
      );
    }

    response.status(status).json({
      errors,
      statusCode: status,
      timestamp: new Date().toISOString(),
    });
  }
}
