// src/expense/expense.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        title: data.title,
        amount: data.amount,
        date: new Date(data.date),
        receiptImage: data.receiptImage,
      },
    });
  }

  async findAll() {
    return this.prisma.expense.findMany({
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  async update(id: number, data: UpdateExpenseDto) {
    await this.findOne(id);

    return this.prisma.expense.update({
      where: { id },
      data: {
        title: data.title,
        amount: data.amount,
        date: data.date ? new Date(data.date) : undefined,
        receiptImage: data.receiptImage,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.expense.delete({ where: { id } });
  }

  async getStats() {
    const [total, count] = await Promise.all([
      this.prisma.expense.aggregate({
        _sum: { amount: true },
      }),
      this.prisma.expense.count(),
    ]);

    return {
      totalAmount: total._sum.amount || 0,
      count,
    };
  }
}
