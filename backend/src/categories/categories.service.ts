// src/categories/categories.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Check if category with same name exists
    const existing = await this.prisma.category.findFirst({
      where: { name: createCategoryDto.name },
    });

    if (existing) {
      throw new BadRequestException(
        `Category with name "${createCategoryDto.name}" already exists.`,
      );
    }

    return await this.prisma.category.create({
      data: createCategoryDto,
    });
  }

  async findAll() {
    return await this.prisma.category.findMany({
      orderBy: { id: 'desc' },
      include: {
        products: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  // New method for paginated categories
  async findAllPaginated(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, search = '' } = paginationDto;
    const skip = (page - 1) * limit;

    // Build where condition for search
    const where = {
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive' as const,
        },
      }),
      products: {
        some: {}, // This ensures category has at least one product
      },
    };

    // Get total count for pagination metadata
    const total = await this.prisma.category.count({ where });

    // Get paginated categories
    const categories = await this.prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: 'desc' },
      include: {
        products: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data: categories,
      metadata: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found.`);
    }

    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    // Check if name is being updated to an existing name
    if (updateCategoryDto.name) {
      const existing = await this.prisma.category.findFirst({
        where: {
          name: updateCategoryDto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `Category with name "${updateCategoryDto.name}" already exists.`,
        );
      }
    }

    return await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(id: number) {
    // Check if category exists
    const category = await this.findOne(id);

    // Check if category has products
    if (category.products && category.products.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with existing products.',
      );
    }

    return await this.prisma.category.delete({
      where: { id },
    });
  }
}
