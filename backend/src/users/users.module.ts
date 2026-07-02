import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey', // Replace with your secret from env
      signOptions: { expiresIn: '1h' },
    }),
  ],
  exports: [UsersService],
})
export class UsersModule {}
