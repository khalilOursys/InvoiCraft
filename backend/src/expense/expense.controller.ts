// src/expense/expense.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpenseService } from './expense.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('receiptImage', {
      storage: diskStorage({
        destination: './uploads/expenses',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(
            null,
            `expense-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf)$/)) {
          return callback(
            new Error('Only image and PDF files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() data: CreateExpenseDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      data.receiptImage = `${file.filename}`;
    }
    return this.expenseService.create(data);
  }

  @Get()
  findAll() {
    return this.expenseService.findAll();
  }

  @Get('stats')
  getStats() {
    return this.expenseService.getStats();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expenseService.findOne(id);
  }

  @Put(':id')
  @UseInterceptors(
    FileInterceptor('receiptImage', {
      storage: diskStorage({
        destination: './uploads/expenses',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(
            null,
            `expense-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf)$/)) {
          return callback(
            new Error('Only image and PDF files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateExpenseDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      data.receiptImage = `${file.filename}`;
    }
    return this.expenseService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.expenseService.remove(id);
  }
}
