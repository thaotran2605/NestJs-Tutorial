import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { I18nContext } from 'nestjs-i18n';

const HTTP_SERVER_ERROR_MIN = 500;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const i18n = I18nContext.current();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const translateIfKey = (msg: string): string => {
      if (!i18n) {
        return msg;
      }
      const keyMatch = msg.match(/((?:errors|common)\.[A-Z0-9_]+)$/);
      if (keyMatch) {
        const key = keyMatch[1];
        const prefix = msg.slice(0, msg.length - key.length);
        return `${prefix}${String(i18n.t(key))}`;
      }
      return msg;
    };

    let errors: Record<string, string[]> | string = 'Internal server error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      if (Array.isArray(resp.message)) {
        errors = {
          body: resp.message.map((item) => translateIfKey(String(item))),
        };
      } else if (typeof resp.message === 'string') {
        errors = { body: [translateIfKey(resp.message)] };
      } else {
        errors = resp as Record<string, string[]>;
      }
    } else if (typeof exceptionResponse === 'string') {
      errors = { body: [translateIfKey(exceptionResponse)] };
    }

    if (status >= HTTP_SERVER_ERROR_MIN) {
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
