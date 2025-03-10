import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor() {}
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    console.log(exception);
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let resp = exception instanceof HttpException ? exception.getResponse() : 'Internal Server Error';

    if (typeof resp['message'] === typeof []) {
      resp['message'] = resp['message'].join(', ');
    }

    // if (process.env.NODE_ENV === 'production') {
    //   return response.status(status).json({
    //     success: false,
    //     message: exception,
    //   });
    // }
    return response.status(status).json({
      success: false,
      message: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal Server Error' : (resp['message'] ?? resp),
    });
  }
}
