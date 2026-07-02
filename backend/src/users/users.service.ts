// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { UpdateUserDto } from './dto/UpdateUserDto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleInit() {
    await this.ensureAdminUserExists();
  }

  private async ensureAdminUserExists() {
    const adminEmail = 'admin.admin@admin.com';
    const adminPassword = 'adminadmin';

    const usersCount = await this.prisma.user.count();

    if (usersCount === 0) {
      const adminUserDto: CreateUserDto = {
        email: adminEmail,
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        telephone: '',
      };

      await this.create(adminUserDto);
    }
  }
  async create(createUserDto: CreateUserDto) {
    // Check if user with same email exists
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new BadRequestException(
        `User with email "${createUserDto.email}" already exists.`,
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    return await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
  }

  async findAll() {
    return await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found.`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found.`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    // Check if user exists
    await this.findOne(id);

    // If password is being updated, hash it
    let data = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Check if email is being updated to an existing email
    if (updateUserDto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException(
          `User with email "${updateUserDto.email}" already exists.`,
        );
      }
    }

    return await this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    // Check if user exists
    await this.findOne(id);

    return await this.prisma.user.delete({
      where: { id },
    });
  }
}
