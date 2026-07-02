// src/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto, cashierId: number) {
    return await this.prisma.$transaction(async (prisma) => {
      // Check stock availability
      for (const item of createOrderDto.items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} not found`,
          );
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
          );
        }
      }

      // Use values from frontend
      const subtotal = createOrderDto.subtotal;
      const discountPercent = createOrderDto.discountPercent || 0;
      const discountAmount =
        createOrderDto.discountAmount || (subtotal * discountPercent) / 100;
      const discountedSubtotal =
        createOrderDto.discountedSubtotal || subtotal - discountAmount;
      const tax = createOrderDto.tax;
      const total = createOrderDto.total;

      // Validate total calculation
      const calculatedTotal = discountedSubtotal + tax;
      if (Math.abs(total - calculatedTotal) > 0.01) {
        throw new BadRequestException(
          `Total amount mismatch. Expected: ${calculatedTotal}, Got: ${total}`,
        );
      }

      // Validate client if provided
      if (createOrderDto.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: createOrderDto.clientId },
        });
        if (!client) {
          throw new NotFoundException(
            `Client with ID ${createOrderDto.clientId} not found`,
          );
        }
      }

      // Determine order status
      const orderStatus =
        createOrderDto.payment.amount >= total
          ? OrderStatus.COMPLETED
          : OrderStatus.PENDING;

      // Generate order number
      const orderNumber = await this.generateOrderNumber(prisma);

      // Create order
      const order = await prisma.order.create({
        data: {
          orderNumber,
          subtotal,
          discountPercent,
          discountAmount,
          discountedSubtotal,
          tax,
          total,
          tableNumber: createOrderDto.tableNumber,
          notes: createOrderDto.notes,
          cashierId: cashierId,
          clientId: createOrderDto.clientId || null,
          status: orderStatus,
          items: {
            create: createOrderDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity,
            })),
          },
          orderPayments: {
            create: {
              amount: createOrderDto.payment.amount,
              method: createOrderDto.payment.method,
              change: createOrderDto.payment.change || 0,
            },
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          orderPayments: true,
          cashier: true,
          client: true,
        },
      });

      // Update product stock
      for (const item of createOrderDto.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return order;
    });
  }

  async updateOrder(
    id: number,
    updateOrderDto: UpdateOrderDto,
    cashierId: number,
  ) {
    const existingOrder = await this.findOne(id);

    if (existingOrder.status === 'COMPLETED') {
      throw new BadRequestException('Cannot update a completed order');
    }

    if (existingOrder.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled order');
    }

    return await this.prisma.$transaction(async (prisma) => {
      // Restore stock from old items
      for (const item of existingOrder.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      // Check stock availability for new items
      if (updateOrderDto.items) {
        for (const item of updateOrderDto.items) {
          if (!item.productId) continue;

          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`,
            );
          }

          if (product.stock < (item.quantity || 0)) {
            throw new BadRequestException(
              `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
            );
          }
        }
      }

      // Delete old order items and payments
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.orderPayment.deleteMany({ where: { orderId: id } });

      // Prepare items and calculate values
      const itemsToUse =
        updateOrderDto.items ||
        existingOrder.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        }));

      const subtotal = updateOrderDto.subtotal ?? existingOrder.subtotal;
      const discountPercent =
        updateOrderDto.discountPercent ?? existingOrder.discountPercent;
      const discountAmount =
        updateOrderDto.discountAmount ?? (subtotal * discountPercent) / 100;
      const discountedSubtotal =
        updateOrderDto.discountedSubtotal ?? subtotal - discountAmount;
      const tax = updateOrderDto.tax ?? existingOrder.tax;
      const total = updateOrderDto.total ?? discountedSubtotal + tax;

      // Validate client
      const clientId = updateOrderDto.clientId ?? existingOrder.clientId;
      if (clientId) {
        const client = await prisma.client.findUnique({
          where: { id: clientId },
        });
        if (!client) {
          throw new NotFoundException(`Client with ID ${clientId} not found`);
        }
      }

      // Determine order status
      const paymentAmount =
        updateOrderDto.payment?.amount ??
        existingOrder.orderPayments[0]?.amount ??
        0;
      const orderStatus =
        paymentAmount >= total ? OrderStatus.COMPLETED : OrderStatus.PENDING;

      // Update order
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          subtotal,
          discountPercent,
          discountAmount,
          discountedSubtotal,
          tax,
          total,
          tableNumber: updateOrderDto.tableNumber ?? existingOrder.tableNumber,
          notes: updateOrderDto.notes ?? existingOrder.notes,
          cashierId: cashierId,
          clientId: clientId,
          status: orderStatus,
          items: {
            create: itemsToUse.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity,
            })),
          },
          orderPayments: {
            create: {
              amount: paymentAmount,
              method:
                updateOrderDto.payment?.method ??
                existingOrder.orderPayments[0]?.method,
              change:
                updateOrderDto.payment?.change ??
                existingOrder.orderPayments[0]?.change ??
                0,
            },
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          orderPayments: true,
          cashier: true,
          client: true,
        },
      });

      // Deduct new stock
      for (const item of itemsToUse) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return updatedOrder;
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  img: true,
                  category: true,
                  vat: true,
                },
              },
            },
          },
          orderPayments: true,
          cashier: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.order.count(),
    ]);

    return {
      orders,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                img: true,
                reference: true,
                category: true,
                vat: true,
              },
            },
          },
        },
        orderPayments: true,
        cashier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
            taxNumber: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        orderPayments: true,
        cashier: true,
        client: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with number ${orderNumber} not found`);
    }

    return order;
  }

  async updateStatus(id: number, updateStatusDto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

    if (
      updateStatusDto.status === 'CANCELLED' &&
      order.status !== 'CANCELLED'
    ) {
      await this.prisma.$transaction(async (prisma) => {
        for (const item of order.items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }

        await prisma.order.update({
          where: { id },
          data: {
            status: updateStatusDto.status,
            notes: updateStatusDto.notes || order.notes,
          },
        });
      });
    } else {
      await this.prisma.order.update({
        where: { id },
        data: {
          status: updateStatusDto.status,
          notes: updateStatusDto.notes || order.notes,
        },
      });
    }

    return this.findOne(id);
  }

  async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const stats = await this.prisma.order.aggregate({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: 'COMPLETED',
      },
      _sum: {
        total: true,
      },
      _count: true,
    });

    const paymentMethods = await this.prisma.orderPayment.groupBy({
      by: ['method'],
      where: {
        order: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
          status: 'COMPLETED',
        },
      },
      _sum: {
        amount: true,
      },
    });

    return {
      totalSales: stats._sum.total || 0,
      totalOrders: stats._count,
      paymentMethods: paymentMethods.map((pm) => ({
        method: pm.method,
        amount: pm._sum.amount || 0,
      })),
    };
  }

  async findByClient(clientId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        where: { clientId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          orderPayments: true,
          cashier: true,
        },
      }),
      this.prisma.order.count({ where: { clientId } }),
    ]);

    return {
      orders,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  private async generateOrderNumber(prisma: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastOrder = await prisma.order.findFirst({
      where: {
        orderNumber: {
          startsWith: `ORD-${dateStr}`,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.orderNumber.split('-')[2]);
      sequence = lastSeq + 1;
    }

    return `ORD-${dateStr}-${sequence.toString().padStart(4, '0')}`;
  }
}
