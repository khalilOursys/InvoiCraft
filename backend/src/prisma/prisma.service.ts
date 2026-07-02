import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';


@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  //Handle common Prisma errors and throw appropriate HTTP exceptions
  async safeExecute<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P2002':
            throw new HttpException(
              `Duplicate value for field: ${error.meta?.target}`,
              HttpStatus.CONFLICT,
            );
          case 'P2025':
            throw new HttpException(`Record not found`, HttpStatus.NOT_FOUND);
          case 'P2003':
            throw new HttpException(
              `Foreign key constraint failed`,
              HttpStatus.BAD_REQUEST,
            );
          default:
            throw new HttpException(
              `Database error: ${error.message}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
      }

      if (error instanceof PrismaClientInitializationError) {
        throw new HttpException(
          `Database initialization failed: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      if (error instanceof PrismaClientValidationError) {
        throw new HttpException(
          `Validation error: ${error.message}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new HttpException(
        'Unexpected database error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Standardized success response format
  successResponse<T>(data: T, message = 'Request successful') {
    return {
      status: 'success',
      statusCode: HttpStatus.OK,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
