export class BaseResponseDto<T> {
  readonly success: boolean;
  readonly message: string;
  readonly data?: T;

  constructor(success: boolean, message?: string, data?: T) {
  }

  static success<T>(success: boolean = true, message: string = 'Request processed successfully', data: T): BaseResponseDto<T> {
    return new BaseResponseDto(success, message, data);
  }

}