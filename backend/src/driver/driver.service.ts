import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { Driver, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DriverService {
  constructor(private prisma: PrismaService) {}

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    // Start a transaction to ensure data consistency
    return await this.prisma.$transaction(async (tx) => {
      // Check if car exists if carId is provided
      if (createDriverDto.carId) {
        const car = await tx.car.findFirst({
          where: { id: createDriverDto.carId },
        });

        if (!car) {
          throw new NotFoundException(
            `Car with ID ${createDriverDto.carId} not found`,
          );
        }
      }

      // Check for unique constraints in service layer
      await this.validateUniqueConstraints(createDriverDto);

      // Create the driver
      const driver = await tx.driver.create({
        data: createDriverDto,
        include: {
          car: true,
        },
      });

      // If CIN is provided, create corresponding user
      if (createDriverDto.cin) {
        await this.createUserFromDriver(createDriverDto);
      }

      return driver;
    });
  }

  async findAll(): Promise<Driver[]> {
    return await this.prisma.driver.findMany({
      include: {
        car: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        car: true,
      },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    return driver;
  }

  async update(id: number, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    return await this.prisma.$transaction(async (tx) => {
      // Check if driver exists
      const existingDriver = await this.findOne(id);

      // Check if car exists if carId is provided
      if (updateDriverDto.carId) {
        const car = await tx.car.findUnique({
          where: { id: updateDriverDto.carId },
        });

        if (!car) {
          throw new NotFoundException(
            `Car with ID ${updateDriverDto.carId} not found`,
          );
        }
      }

      // Check for unique constraints on update
      await this.validateUniqueConstraintsForUpdate(id, updateDriverDto);

      // Update the driver
      const updatedDriver = await tx.driver.update({
        where: { id },
        data: updateDriverDto,
        include: {
          car: true,
        },
      });

      // Handle user creation/update if CIN is provided
      if (updateDriverDto.cin) {
        await this.createOrUpdateUserFromDriver(updatedDriver);
      }

      return updatedDriver;
    });
  }

  async remove(id: number): Promise<Driver> {
    return await this.prisma.$transaction(async (tx) => {
      const driver = await this.findOne(id);

      // Optionally handle user deactivation
      if (driver?.cin) {
        await tx.user.updateMany({
          where: { cin: driver.cin },
          data: {
            // You might want to mark as inactive or handle differently
            role: UserRole.COMMERCIAL,
          },
        });
      }

      return await tx.driver.delete({
        where: { id },
      });
    });
  }

  async toggleActive(id: number): Promise<Driver> {
    const driver = await this.findOne(id);

    return await this.prisma.driver.update({
      where: { id },
      data: { active: !driver.active },
      include: {
        car: true,
      },
    });
  }

  async findByCar(carId: number): Promise<Driver[]> {
    return await this.prisma.driver.findMany({
      where: { carId },
      include: {
        car: true,
      },
    });
  }

  async findActive(): Promise<Driver[]> {
    return await this.prisma.driver.findMany({
      where: { active: true },
      include: {
        car: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async findByEmail(email: string): Promise<Driver | null> {
    return await this.prisma.driver.findFirst({
      where: { email },
      include: {
        car: true,
      },
    });
  }

  async findByCin(cin: string): Promise<Driver | null> {
    return await this.prisma.driver.findFirst({
      where: { cin },
      include: {
        car: true,
      },
    });
  }

  /**
   * Validate unique constraints for create operation
   */
  private async validateUniqueConstraints(dto: CreateDriverDto): Promise<void> {
    if (dto.cin) {
      const existingDriver = await this.prisma.driver.findFirst({
        where: { cin: dto.cin },
      });
      if (existingDriver) {
        throw new ConflictException('CIN already exists for another driver');
      }

      const existingUser = await this.prisma.user.findFirst({
        where: { cin: dto.cin },
      });
      if (existingUser) {
        throw new ConflictException('CIN is already associated with a user');
      }
    }

    if (dto.email) {
      const existingDriver = await this.prisma.driver.findFirst({
        where: { email: dto.email },
      });
      if (existingDriver) {
        throw new ConflictException('Email already exists for another driver');
      }

      const existingUser = await this.prisma.user.findFirst({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email is already associated with a user');
      }
    }

    if (dto.licenseNumber) {
      const existingDriver = await this.prisma.driver.findFirst({
        where: { licenseNumber: dto.licenseNumber },
      });
      if (existingDriver) {
        throw new ConflictException('License number already exists');
      }
    }
  }

  /**
   * Validate unique constraints for update operation
   */
  private async validateUniqueConstraintsForUpdate(
    id: number,
    dto: UpdateDriverDto,
  ): Promise<void> {
    if (dto.cin) {
      const existingDriver = await this.prisma.driver.findFirst({
        where: {
          cin: dto.cin,
          NOT: { id: id },
        },
      });
      if (existingDriver) {
        throw new ConflictException('CIN already exists for another driver');
      }
    }

    if (dto.email) {
      const existingDriver = await this.prisma.driver.findFirst({
        where: {
          email: dto.email,
          NOT: { id: id },
        },
      });
      if (existingDriver) {
        throw new ConflictException('Email already exists for another driver');
      }
    }

    if (dto.licenseNumber) {
      const existingDriver = await this.prisma.driver.findFirst({
        where: {
          licenseNumber: dto.licenseNumber,
          NOT: { id: id },
        },
      });
      if (existingDriver) {
        throw new ConflictException('License number already exists');
      }
    }
  }

  /**
   * Create a user from driver data (using CIN as password)
   */
  private async createUserFromDriver(
    driverData: CreateDriverDto,
  ): Promise<void> {
    if (!driverData.cin) return;

    // Determine email to use
    const email = driverData.email || this.generateEmailFromDriver(driverData);

    // Check if email is already used
    const existingUserByEmail = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUserByEmail) {
      throw new ConflictException(`Email ${email} is already in use`);
    }

    // Use CIN as password (hashed)
    const hashedPassword = await bcrypt.hash(driverData.cin, 10);

    await this.prisma.user.create({
      data: {
        cin: driverData.cin,
        firstName: driverData.firstName,
        lastName: driverData.lastName,
        telephone: driverData.phone,
        email: email,
        password: hashedPassword,
        role: UserRole.COMMERCIAL,
      },
    });
  }

  /**
   * Create or update user from driver data (for both create and update operations)
   */
  private async createOrUpdateUserFromDriver(
    driverData: Driver,
  ): Promise<void> {
    if (!driverData.cin) return;

    // Convert null values to undefined for the DTO
    const driverDto: Partial<CreateDriverDto> = {
      firstName: driverData.firstName,
      lastName: driverData.lastName,
      phone: driverData.phone || undefined,
      email: driverData.email || undefined,
      cin: driverData.cin || undefined,
      licenseNumber: driverData.licenseNumber || undefined,
    };

    // Check if user exists with this CIN
    let user = await this.prisma.user.findFirst({
      where: { cin: driverData.cin },
    });

    if (!user) {
      // Check if user exists with this email
      const email = driverData.email || this.generateEmailFromDriver(driverDto);

      user = await this.prisma.user.findFirst({
        where: { email },
      });

      if (user) {
        // Update existing user with CIN
        const hashedPassword = await bcrypt.hash(driverData.cin, 10);
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            cin: driverData.cin,
            firstName: driverData.firstName,
            lastName: driverData.lastName,
            telephone: driverData.phone,
            password: hashedPassword,
          },
        });
      } else {
        // Create new user
        const hashedPassword = await bcrypt.hash(driverData.cin, 10);
        await this.prisma.user.create({
          data: {
            cin: driverData.cin,
            firstName: driverData.firstName,
            lastName: driverData.lastName,
            telephone: driverData.phone,
            email: email,
            password: hashedPassword,
            role: UserRole.COMMERCIAL,
          },
        });
      }
    } else {
      // Update existing user
      const updateData: any = {
        firstName: driverData.firstName,
        lastName: driverData.lastName,
        telephone: driverData.phone,
        email: driverData.email || user.email,
      };

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }
  }

  /**
   * Generate a unique email from driver data
   */
  private generateEmailFromDriver(
    driverData: Partial<CreateDriverDto>,
  ): string {
    const sanitizedFirstName = (driverData.firstName || 'driver')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const sanitizedLastName = (driverData.lastName || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const cin = driverData.cin || '0000';
    return `${sanitizedFirstName}.${sanitizedLastName}.${cin}@driver.example.com`;
  }
}
