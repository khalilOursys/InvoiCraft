// src/sale-invoice/sale-invoice.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilterSaleInvoiceDto } from './dto/filter-sale-invoice.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { InvoiceStatus, SaleInvoiceType, Prisma } from '@prisma/client';
import { CreateSaleInvoiceDto } from './dto/create-sale-invoice.dto';
import { UpdateSaleInvoiceDto } from './dto/update-sale-invoice.dto';

@Injectable()
export class SaleInvoiceService {
  constructor(private prisma: PrismaService) {}

  async create(createSaleInvoiceDto: CreateSaleInvoiceDto) {
    const {
      items,
      clientId,
      driverId,
      startDate,
      endDate,
      cityIds,
      shippingNoteId,
      deliveryNoteIds,
      ...invoiceData
    } = createSaleInvoiceDto;

    // Validate that cityIds are provided for SHIPPING_NOTE_INVOICE type
    if (
      invoiceData.type === SaleInvoiceType.SHIPPING_NOTE_INVOICE &&
      (!cityIds || cityIds.length === 0)
    ) {
      throw new BadRequestException(
        'At least one city must be selected for shipping note invoice',
      );
    }

    // NEW: Validate deliveryNoteIds for SALE_INVOICE type
    if (
      invoiceData.type === SaleInvoiceType.SALE_INVOICE &&
      deliveryNoteIds &&
      deliveryNoteIds.length > 0
    ) {
      // Check if all delivery notes exist and are of correct type
      const deliveryNotes = await this.prisma.saleInvoice.findMany({
        where: {
          id: {
            in: deliveryNoteIds,
          },
          type: SaleInvoiceType.DELIVERY_NOTE,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          client: true,
        },
      });

      if (deliveryNotes.length !== deliveryNoteIds.length) {
        const foundIds = deliveryNotes.map((dn) => dn.id);
        const missingIds = deliveryNoteIds.filter(
          (id) => !foundIds.includes(id),
        );
        throw new NotFoundException(
          `Delivery notes with IDs ${missingIds.join(', ')} not found or are not DELIVERY_NOTE type`,
        );
      }

      // Validate that all delivery notes have the same client
      const firstClientId = deliveryNotes[0]?.clientId;
      const allSameClient = deliveryNotes.every(
        (dn) => dn.clientId === firstClientId,
      );

      if (!allSameClient) {
        throw new BadRequestException(
          'All delivery notes must belong to the same client when consolidating into one invoice',
        );
      }

      // Validate that clientId matches (if provided)
      if (clientId && clientId !== firstClientId) {
        throw new BadRequestException(
          'Client ID does not match the client of the selected delivery notes',
        );
      }

      // Validate that no delivery note is already consolidated
      //Delete this comment if the customer requests this condition.
      /* for (const dn of deliveryNotes) {
        const existingConsolidation =
          await this.prisma.deliveryNoteConsolidation.findFirst({
            where: {
              sourceDeliveryNoteId: dn.id,
            },
          });

        if (existingConsolidation) {
          throw new BadRequestException(
            `Delivery note ${dn.invoiceNumber} is already consolidated into another invoice`,
          );
        }
      } */
    }

    // Start a transaction
    return this.prisma.$transaction(async (prisma) => {
      // Check if client exists
      if (clientId) {
        const client = await prisma.client.findUnique({
          where: { id: clientId },
        });

        if (!client) {
          throw new NotFoundException(`Client with ID ${clientId} not found`);
        }
      }

      // Check if driver exists (if provided)
      if (driverId) {
        const driver = await prisma.driver.findUnique({
          where: { id: driverId },
        });

        if (!driver) {
          throw new NotFoundException(`Driver with ID ${driverId} not found`);
        }
      }

      // Check if shipping note exists (if provided)
      if (shippingNoteId) {
        const shippingNote = await prisma.saleInvoice.findUnique({
          where: { id: shippingNoteId },
          include: { items: true },
        });

        if (!shippingNote) {
          throw new NotFoundException(
            `Shipping note with ID ${shippingNoteId} not found`,
          );
        }

        // Validate that the shipping note is of the correct type
        if (shippingNote.type !== SaleInvoiceType.SHIPPING_NOTE_INVOICE) {
          throw new BadRequestException(
            `Invoice with ID ${shippingNoteId} is not a shipping note invoice`,
          );
        }

        // Validate that the shipping note items have sufficient quantity
        for (const item of items) {
          if (item.shippingNoteItemId) {
            const shippingNoteItem = shippingNote.items.find(
              (si) => si.id === item.shippingNoteItemId,
            );

            if (!shippingNoteItem) {
              throw new NotFoundException(
                `Shipping note item with ID ${item.shippingNoteItemId} not found`,
              );
            }

            if (shippingNoteItem.quantity < item.quantity) {
              throw new BadRequestException(
                `Insufficient quantity for product. Available: ${shippingNoteItem.quantity}, Requested: ${item.quantity}`,
              );
            }
          }
        }
      }

      // Check if cities exist (if provided)
      if (cityIds && cityIds.length > 0) {
        const cities = await prisma.city.findMany({
          where: {
            id: {
              in: cityIds,
            },
          },
        });

        if (cities.length !== cityIds.length) {
          const foundCityIds = cities.map((c) => c.id);
          const missingCityIds = cityIds.filter(
            (id) => !foundCityIds.includes(id),
          );
          throw new NotFoundException(
            `Cities with IDs ${missingCityIds.join(', ')} not found`,
          );
        }
      }

      // Check if invoice number already exists
      const existingInvoice = await prisma.saleInvoice.findFirst({
        where: { invoiceNumber: invoiceData.invoiceNumber },
      });

      //remove this comment after meet with custumer
      /* if (existingInvoice) {
        throw new BadRequestException('Invoice number already exists');
      } */

      // Check if all products exist and have sufficient stock if status is VALIDATED
      //Delete this comment if the customer requests this condition.
      for (const item of items) {
        const product = await prisma.product.findFirst({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundException(
            `Product with ID ${item.productId} not found`,
          );
        }

        // Check stock if invoice is being created as VALIDATED
        //Delete this comment if the customer requests this condition.
        /* if (invoiceData.status === InvoiceStatus.VALIDATED) {
          if (product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
            );
          }
        } */
      }

      // Calculate VAT and totals
      let totalHT = 0;
      let totalTTC = 0;
      const calculatedItems = items.map((item) => {
        const vatRate = item.vatRate || 0;
        const itemTotalHT = item.price * item.quantity;
        const itemVatAmount = itemTotalHT * (vatRate / 100);
        const itemTotalTTC = itemTotalHT + itemVatAmount;

        totalHT += itemTotalHT;
        totalTTC += itemTotalTTC;

        return {
          ...item,
          vatRate,
          vatAmount: itemVatAmount,
        };
      });

      // Add tax stamp to total TTC if applicable
      const taxStamp = invoiceData.taxStamp || 0;
      totalTTC += taxStamp;

      // Use provided totals or calculated ones
      totalHT = createSaleInvoiceDto.totalHT || totalHT;
      totalTTC = createSaleInvoiceDto.totalTTC || totalTTC;

      // Create invoice with items and cities
      const invoice = await prisma.saleInvoice.create({
        data: {
          ...invoiceData,
          date: new Date(invoiceData.date),
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          totalHT,
          totalTTC,
          taxStamp,
          clientId: clientId || null,
          driverId: driverId || null,
          shippingNoteId: shippingNoteId || null,
          type: invoiceData.type || SaleInvoiceType.SALE_INVOICE,
          status: invoiceData.status || InvoiceStatus.DRAFT,
          items: {
            create: calculatedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              vatRate: item.vatRate,
              vatAmount: item.vatAmount,
              shippingNoteItemId: item.shippingNoteItemId || null,
            })),
          },
          // Add cities if provided
          ...(cityIds &&
            cityIds.length > 0 && {
              cities: {
                create: cityIds.map((cityId) => ({
                  cityId,
                })),
              },
            }),
        },
        include: {
          client: true,
          driver: {
            include: {
              car: true,
            },
          },
          cities: {
            include: {
              city: true,
            },
          },
          items: {
            include: {
              product: true,
              shippingNoteItem: {
                include: {
                  product: true,
                  invoice: {
                    select: {
                      id: true,
                      invoiceNumber: true,
                      date: true,
                    },
                  },
                },
              },
            },
          },
          shippingNote: {
            include: {
              client: true,
              driver: true,
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      // NEW: Create delivery note consolidations if deliveryNoteIds provided
      if (
        deliveryNoteIds &&
        deliveryNoteIds.length > 0 &&
        invoice.type === SaleInvoiceType.SALE_INVOICE
      ) {
        await prisma.deliveryNoteConsolidation.createMany({
          data: deliveryNoteIds.map((deliveryNoteId) => ({
            consolidatedSaleInvoiceId: invoice.id,
            sourceDeliveryNoteId: deliveryNoteId,
          })),
        });
      }

      // Update product stock and shipping note items only if status is VALIDATED
      /* if (invoice.status === InvoiceStatus.VALIDATED) {
        // Update product stock for sale invoices
        if (
          invoice.type === SaleInvoiceType.SALE_INVOICE ||
          invoice.type === SaleInvoiceType.DELIVERY_NOTE ||
          invoice.type === SaleInvoiceType.SHIPPING_NOTE_INVOICE
        ) {
          for (const item of calculatedItems) {
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });
          }
        }

        // Update shipping note items quantity if this is a delivery note
        if (shippingNoteId && invoice.type === SaleInvoiceType.DELIVERY_NOTE) {
          for (const item of calculatedItems) {
            if (item.shippingNoteItemId) {
              // Decrement the quantity in the shipping note item
              await prisma.saleInvoiceItem.update({
                where: { id: item.shippingNoteItemId },
                data: {
                  quantity: {
                    decrement: item.quantity,
                  },
                },
              });
            }
          }
        }
      } */
      // Update product stock and shipping note items only if status is VALIDATED
      if (invoice.status === InvoiceStatus.VALIDATED) {
        // Update product stock for sale invoices
        if (
          invoice.type === SaleInvoiceType.SALE_INVOICE ||
          invoice.type === SaleInvoiceType.DELIVERY_NOTE ||
          invoice.type === SaleInvoiceType.SHIPPING_NOTE_INVOICE
        ) {
          // For SALE_INVOICE type, only decrement stock if no delivery notes are being consolidated
          if (
            invoice.type === SaleInvoiceType.SALE_INVOICE &&
            deliveryNoteIds &&
            deliveryNoteIds.length > 0
          ) {
            // Skip stock decrement for SALE_INVOICE when consolidating delivery notes
            // because stock was already decremented when the delivery notes were created
            console.log(
              'Skipping stock decrement for consolidated SALE_INVOICE',
            );
          } else {
            // Decrement stock for all other cases
            for (const item of calculatedItems) {
              await prisma.product.update({
                where: { id: item.productId },
                data: {
                  stock: {
                    decrement: item.quantity,
                  },
                },
              });
            }
          }
        }

        // Update shipping note items quantity if this is a delivery note
        if (shippingNoteId && invoice.type === SaleInvoiceType.DELIVERY_NOTE) {
          for (const item of calculatedItems) {
            if (item.shippingNoteItemId) {
              // Decrement the quantity in the shipping note item
              await prisma.saleInvoiceItem.update({
                where: { id: item.shippingNoteItemId },
                data: {
                  quantity: {
                    decrement: item.quantity,
                  },
                },
              });
            }
          }
        }
      }

      return invoice;
    });
  }

  async findAll(filterDto?: FilterSaleInvoiceDto) {
    const where: Prisma.SaleInvoiceWhereInput = {};

    if (filterDto) {
      // Date range filter
      if (filterDto.startDate || filterDto.endDate) {
        where.date = {} as Prisma.DateTimeFilter;

        if (filterDto.startDate) {
          (where.date as Prisma.DateTimeFilter).gte = new Date(
            filterDto.startDate,
          );
        }
        if (filterDto.endDate) {
          (where.date as Prisma.DateTimeFilter).lte = new Date(
            filterDto.endDate,
          );
        }
      }

      // Alternative date range filter
      if (filterDto.dateFrom || filterDto.dateTo) {
        if (!where.date) {
          where.date = {} as Prisma.DateTimeFilter;
        }

        const dateFilter = where.date as Prisma.DateTimeFilter;

        if (filterDto.dateFrom) {
          dateFilter.gte = new Date(filterDto.dateFrom);
        }
        if (filterDto.dateTo) {
          dateFilter.lte = new Date(filterDto.dateTo);
        }
      }

      // Status filter
      if (filterDto.status) {
        where.status = filterDto.status;
      }

      // Type filter
      if (filterDto.type) {
        where.type = filterDto.type;
      }

      // Invoice number filter (partial match)
      if (filterDto.invoiceNumber) {
        where.invoiceNumber = {
          contains: filterDto.invoiceNumber,
          mode: 'insensitive',
        };
      }

      // Client name filter
      if (filterDto.clientName) {
        where.client = {
          name: {
            contains: filterDto.clientName,
            mode: 'insensitive',
          },
        };
      }

      // Driver filter by ID
      if (filterDto.driverId) {
        where.driverId = filterDto.driverId;
      }

      // Driver filter by CIN - NEW
      if (filterDto.driverCIN) {
        where.driver = {
          cin: {
            equals: filterDto.driverCIN,
            mode: 'insensitive',
          },
        };
      }

      // Client id filter
      if (filterDto.clientId) {
        where.clientId = filterDto.clientId;
      }

      // Has driver filter
      if (filterDto.hasDriver !== undefined) {
        where.driverId = filterDto.hasDriver ? { not: null } : null;
      }

      // Filter by shipping note ID
      if (filterDto.shippingNoteId) {
        where.shippingNoteId = filterDto.shippingNoteId;
      }
    }

    return this.prisma.saleInvoice.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        driver: {
          include: {
            car: true,
          },
        },
        cities: {
          include: {
            city: true,
          },
        },
        payments: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                reference: true,
                name: true,
                salePrice: true,
              },
            },
            shippingNoteItem: {
              select: {
                id: true,
                quantity: true,
                price: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                invoice: {
                  select: {
                    id: true,
                    invoiceNumber: true,
                    date: true,
                  },
                },
              },
            },
          },
        },
        shippingNote: {
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                cin: true,
              },
            },
          },
        },
        deliveryNotes: {
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        consolidatedDeliveryNotes: {
          include: {
            sourceDeliveryNote: {
              select: {
                id: true,
                invoiceNumber: true,
                date: true,
                client: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        consolidatedInInvoice: {
          include: {
            consolidatedSaleInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                date: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const invoice = await this.prisma.saleInvoice.findUnique({
      where: { id },
      include: {
        client: true,
        driver: {
          include: {
            car: true,
          },
        },
        cities: {
          include: {
            city: true,
          },
        },
        items: {
          include: {
            product: true,
            shippingNoteItem: {
              include: {
                product: true,
                invoice: {
                  select: {
                    id: true,
                    invoiceNumber: true,
                    date: true,
                    client: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        payments: true,
        originalInvoice: true,
        refunds: true,
        shippingNote: {
          include: {
            client: true,
            driver: {
              include: {
                car: true,
              },
            },
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        deliveryNotes: {
          include: {
            client: true,
            driver: {
              include: {
                car: true,
              },
            },
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        // NEW: Include consolidated delivery notes
        consolidatedDeliveryNotes: {
          include: {
            sourceDeliveryNote: {
              include: {
                client: true,
                driver: true,
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Sale invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async findByInvoiceNumber(invoiceNumber: string) {
    const invoice = await this.prisma.saleInvoice.findFirst({
      where: { invoiceNumber },
      include: {
        client: true,
        driver: {
          include: {
            car: true,
          },
        },
        cities: {
          include: {
            city: true,
          },
        },
        items: {
          include: {
            product: true,
            shippingNoteItem: {
              include: {
                product: true,
                invoice: true,
              },
            },
          },
        },
        payments: true,
        shippingNote: true,
        deliveryNotes: true,
        // NEW: Include consolidated delivery notes
        consolidatedDeliveryNotes: {
          include: {
            sourceDeliveryNote: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Sale invoice with number ${invoiceNumber} not found`,
      );
    }

    return invoice;
  }

  async findByClient(clientId: number) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    return this.prisma.saleInvoice.findMany({
      where: { clientId },
      include: {
        client: true,
        driver: {
          include: {
            car: true,
          },
        },
        cities: {
          include: {
            city: true,
          },
        },
        items: {
          include: {
            product: true,
            shippingNoteItem: true,
          },
        },
        shippingNote: true,
        deliveryNotes: true,
        // NEW: Include consolidated delivery notes
        consolidatedDeliveryNotes: {
          include: {
            sourceDeliveryNote: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByDriver(driverId: number) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    return this.prisma.saleInvoice.findMany({
      where: { driverId },
      include: {
        client: true,
        driver: {
          include: {
            car: true,
          },
        },
        cities: {
          include: {
            city: true,
          },
        },
        items: {
          include: {
            product: true,
            shippingNoteItem: true,
          },
        },
        shippingNote: true,
        deliveryNotes: true,
        // NEW: Include consolidated delivery notes
        consolidatedDeliveryNotes: {
          include: {
            sourceDeliveryNote: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: number, updateSaleInvoiceDto: UpdateSaleInvoiceDto) {
    // Check if invoice exists
    const existingInvoice = await this.findOne(id);

    const {
      items,
      clientId,
      driverId,
      startDate,
      endDate,
      cityIds,
      shippingNoteId,
      deliveryNoteIds, // NEW: Array of delivery note IDs to consolidate
      ...updateData
    } = updateSaleInvoiceDto;

    // Determine if status is being changed to VALIDATED
    const isChangingToValidated =
      updateData.status === InvoiceStatus.VALIDATED &&
      existingInvoice.status !== InvoiceStatus.VALIDATED;

    // Determine if invoice is or will become VALIDATED
    const isOrWillBeValidated =
      existingInvoice.status === InvoiceStatus.VALIDATED ||
      isChangingToValidated;

    // Start a transaction
    return this.prisma.$transaction(async (prisma) => {
      // If clientId is being updated, check if new client exists
      if (clientId) {
        const client = await prisma.client.findFirst({
          where: { id: clientId },
        });

        if (!client) {
          throw new NotFoundException(`Client with ID ${clientId} not found`);
        }
      }

      // If driverId is being updated, check if new driver exists
      if (driverId) {
        const driver = await prisma.driver.findFirst({
          where: { id: driverId },
        });

        if (!driver) {
          throw new NotFoundException(`Driver with ID ${driverId} not found`);
        }
      }

      // If shippingNoteId is being updated, check if new shipping note exists
      if (shippingNoteId) {
        const shippingNote = await prisma.saleInvoice.findUnique({
          where: { id: shippingNoteId },
          include: { items: true },
        });

        if (!shippingNote) {
          throw new NotFoundException(
            `Shipping note with ID ${shippingNoteId} not found`,
          );
        }

        // Validate that the shipping note is of the correct type
        if (shippingNote.type !== SaleInvoiceType.SHIPPING_NOTE_INVOICE) {
          throw new BadRequestException(
            `Invoice with ID ${shippingNoteId} is not a shipping note invoice`,
          );
        }

        // If items are also being updated, validate quantities
        if (items && items.length > 0) {
          for (const item of items) {
            if (item.shippingNoteItemId) {
              const shippingNoteItem = shippingNote.items.find(
                (si) => si.id === item.shippingNoteItemId,
              );

              if (!shippingNoteItem) {
                throw new NotFoundException(
                  `Shipping note item with ID ${item.shippingNoteItemId} not found`,
                );
              }

              // Get current usage of this shipping note item from other delivery notes
              const otherDeliveryNotes = await prisma.saleInvoice.findMany({
                where: {
                  shippingNoteId: shippingNoteId,
                  type: SaleInvoiceType.DELIVERY_NOTE,
                  id: { not: id }, // Exclude current invoice
                  status: InvoiceStatus.VALIDATED, // Only consider VALIDATED delivery notes
                },
                include: { items: true },
              });

              const totalUsedFromOtherNotes = otherDeliveryNotes.reduce(
                (total, note) => {
                  const matchingItem = note.items.find(
                    (ni) => ni.shippingNoteItemId === item.shippingNoteItemId,
                  );
                  return total + (matchingItem?.quantity || 0);
                },
                0,
              );

              const availableQuantity =
                shippingNoteItem.quantity - totalUsedFromOtherNotes;

              if (item.quantity > availableQuantity) {
                throw new BadRequestException(
                  `Insufficient quantity for product. Available: ${availableQuantity}, Requested: ${item.quantity}`,
                );
              }
            }
          }
        }
      }

      // NEW: Validate deliveryNoteIds for SALE_INVOICE type
      if (
        deliveryNoteIds !== undefined &&
        existingInvoice.type === SaleInvoiceType.SALE_INVOICE
      ) {
        if (deliveryNoteIds.length > 0) {
          // Check if all delivery notes exist and are of correct type
          const deliveryNotes = await prisma.saleInvoice.findMany({
            where: {
              id: {
                in: deliveryNoteIds,
              },
              type: SaleInvoiceType.DELIVERY_NOTE,
            },
          });

          if (deliveryNotes.length !== deliveryNoteIds.length) {
            const foundIds = deliveryNotes.map((dn) => dn.id);
            const missingIds = deliveryNoteIds.filter(
              (id) => !foundIds.includes(id),
            );
            throw new NotFoundException(
              `Delivery notes with IDs ${missingIds.join(', ')} not found or are not DELIVERY_NOTE type`,
            );
          }

          // Validate that all delivery notes have the same client
          const targetClientId = clientId || existingInvoice.clientId;
          const allSameClient = deliveryNotes.every(
            (dn) => dn.clientId === targetClientId,
          );

          if (!allSameClient && targetClientId) {
            throw new BadRequestException(
              'All delivery notes must belong to the same client when consolidating into one invoice',
            );
          }

          // Validate that no delivery note is already consolidated (except by this invoice)
          //Delete this comment if the customer requests this condition.
          /* for (const dn of deliveryNotes) {
            const existingConsolidation =
              await prisma.deliveryNoteConsolidation.findFirst({
                where: {
                  sourceDeliveryNoteId: dn.id,
                  consolidatedSaleInvoiceId: { not: id },
                },
              });

            if (existingConsolidation) {
              throw new BadRequestException(
                `Delivery note ${dn.invoiceNumber} is already consolidated into another invoice`,
              );
            }
          } */
        }
      }

      // Check if cities exist (if provided)
      if (cityIds && cityIds.length > 0) {
        const cities = await prisma.city.findMany({
          where: {
            id: {
              in: cityIds,
            },
          },
        });

        if (cities.length !== cityIds.length) {
          const foundCityIds = cities.map((c) => c.id);
          const missingCityIds = cityIds.filter(
            (id) => !foundCityIds.includes(id),
          );
          throw new NotFoundException(
            `Cities with IDs ${missingCityIds.join(', ')} not found`,
          );
        }
      }

      // If invoice number is being updated, check if it's unique
      if (
        updateData.invoiceNumber &&
        updateData.invoiceNumber !== existingInvoice.invoiceNumber
      ) {
        const invoiceWithSameNumber = await prisma.saleInvoice.findFirst({
          where: { invoiceNumber: updateData.invoiceNumber },
        });

        //remove this comment after meet with custumer
        /* if (invoiceWithSameNumber) {
        throw new BadRequestException('Invoice number already exists');
      } */
      }

      // Handle items update if provided
      if (items && items.length > 0) {
        // Check if all products exist and have sufficient stock if invoice is or will be VALIDATED
        for (const item of items) {
          if (item.productId) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
            });

            if (!product) {
              throw new NotFoundException(
                `Product with ID ${item.productId} not found`,
              );
            }

            // Check stock if invoice is or will be VALIDATED
            if (isOrWillBeValidated) {
              // Calculate the net change in quantity for this product
              const oldItemQuantity =
                existingInvoice.items.find(
                  (oldItem) => oldItem.productId === item.productId,
                )?.quantity || 0;

              const quantityChange = item.quantity - oldItemQuantity;

              if (quantityChange > 0 && product.stock < quantityChange) {
                throw new BadRequestException(
                  `Insufficient stock for product ${product.name}. Available: ${product.stock}, Additional needed: ${quantityChange}`,
                );
              }
            }
          }
        }

        // Calculate VAT for items
        const calculatedItems = items.map((item) => {
          const vatRate = item.vatRate || 0;
          const itemTotalHT = (item.price || 0) * (item.quantity || 0);
          const vatAmount = itemTotalHT * (vatRate / 100);

          return {
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            vatRate,
            vatAmount,
            shippingNoteItemId: item.shippingNoteItemId || null,
          };
        });

        // Calculate new totals
        const newTotalHT = calculatedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
        const newTotalTTC =
          calculatedItems.reduce(
            (sum, item) =>
              sum + item.price * item.quantity * (1 + item.vatRate / 100),
            0,
          ) + (updateData.taxStamp || existingInvoice.taxStamp || 0);

        updateData.totalHT = newTotalHT;
        updateData.totalTTC = newTotalTTC;

        // Handle stock updates if invoice is or will be VALIDATED
        /* if (isOrWillBeValidated) {
          // If invoice was already VALIDATED, restore old stock first
          if (existingInvoice.status === InvoiceStatus.VALIDATED) {
            console.log('Restoring old stock for previously VALIDATED invoice');

            // Restore old stock
            for (const oldItem of existingInvoice.items) {
              await prisma.product.update({
                where: { id: oldItem.productId },
                data: {
                  stock: {
                    increment: oldItem.quantity,
                  },
                },
              });
            }

            // Restore old shipping note item quantities if this is a delivery note
            if (
              existingInvoice.shippingNoteId &&
              existingInvoice.type === SaleInvoiceType.DELIVERY_NOTE
            ) {
              for (const oldItem of existingInvoice.items) {
                if (oldItem.shippingNoteItemId) {
                  await prisma.saleInvoiceItem.update({
                    where: { id: oldItem.shippingNoteItemId },
                    data: {
                      quantity: {
                        increment: oldItem.quantity,
                      },
                    },
                  });
                }
              }
            }
          }

          console.log('Decrementing stock for new items');

          // Decrement new stock
          for (const newItem of calculatedItems) {
            await prisma.product.update({
              where: { id: newItem.productId },
              data: {
                stock: {
                  decrement: newItem.quantity,
                },
              },
            });
          }

          // Handle shipping note item quantity updates if this is a delivery note
          const targetShippingNoteId =
            shippingNoteId || existingInvoice.shippingNoteId;
          const invoiceType = updateData.type || existingInvoice.type;

          if (
            targetShippingNoteId &&
            invoiceType === SaleInvoiceType.DELIVERY_NOTE
          ) {
            console.log('Updating shipping note item quantities');

            // Decrement new shipping note item quantities
            for (const newItem of calculatedItems) {
              if (newItem.shippingNoteItemId) {
                await prisma.saleInvoiceItem.update({
                  where: { id: newItem.shippingNoteItemId },
                  data: {
                    quantity: {
                      decrement: newItem.quantity,
                    },
                  },
                });
              }
            }
          }
        } */
        // Handle stock updates if invoice is or will be VALIDATED
        if (isOrWillBeValidated) {
          // Check if this invoice has or will have consolidated delivery notes
          const hasConsolidatedDeliveryNotes =
            (deliveryNoteIds && deliveryNoteIds.length > 0) ||
            (existingInvoice.consolidatedDeliveryNotes &&
              existingInvoice.consolidatedDeliveryNotes.length > 0);

          const targetType = updateData.type || existingInvoice.type;

          // For SALE_INVOICE type, only handle stock if no delivery notes are consolidated
          if (
            targetType === SaleInvoiceType.SALE_INVOICE &&
            hasConsolidatedDeliveryNotes
          ) {
            console.log('Skipping stock updates for consolidated SALE_INVOICE');
          } else {
            // If invoice was already VALIDATED, restore old stock first
            if (existingInvoice.status === InvoiceStatus.VALIDATED) {
              // Restore old stock
              for (const oldItem of existingInvoice.items) {
                await prisma.product.update({
                  where: { id: oldItem.productId },
                  data: {
                    stock: {
                      increment: oldItem.quantity,
                    },
                  },
                });
              }
            }

            // Decrement new stock
            for (const newItem of calculatedItems) {
              await prisma.product.update({
                where: { id: newItem.productId },
                data: {
                  stock: {
                    decrement: newItem.quantity,
                  },
                },
              });
            }
          }

          // Handle shipping note item quantity updates if this is a delivery note
          const targetShippingNoteId =
            shippingNoteId || existingInvoice.shippingNoteId;
          const invoiceType = updateData.type || existingInvoice.type;

          if (
            targetShippingNoteId &&
            invoiceType === SaleInvoiceType.DELIVERY_NOTE
          ) {
            // Decrement new shipping note item quantities
            for (const newItem of calculatedItems) {
              if (newItem.shippingNoteItemId) {
                await prisma.saleInvoiceItem.update({
                  where: { id: newItem.shippingNoteItemId },
                  data: {
                    quantity: {
                      decrement: newItem.quantity,
                    },
                  },
                });
              }
            }
          }
        }
        // Delete existing items and create new ones
        await prisma.saleInvoiceItem.deleteMany({
          where: { invoiceId: id },
        });

        await prisma.saleInvoiceItem.createMany({
          data: calculatedItems.map((item) => ({
            ...item,
            invoiceId: id,
          })),
        });
      }

      // Handle cities update if provided
      if (cityIds !== undefined) {
        // Delete existing city associations
        await prisma.saleInvoiceCity.deleteMany({
          where: { saleInvoiceId: id },
        });

        // Create new city associations
        if (cityIds.length > 0) {
          await prisma.saleInvoiceCity.createMany({
            data: cityIds.map((cityId) => ({
              saleInvoiceId: id,
              cityId,
            })),
          });
        }
      }

      // NEW: Handle delivery note consolidations update if provided
      if (
        deliveryNoteIds !== undefined &&
        existingInvoice.type === SaleInvoiceType.SALE_INVOICE
      ) {
        // Delete existing consolidations
        await prisma.deliveryNoteConsolidation.deleteMany({
          where: { consolidatedSaleInvoiceId: id },
        });

        // Create new consolidations
        if (deliveryNoteIds.length > 0) {
          await prisma.deliveryNoteConsolidation.createMany({
            data: deliveryNoteIds.map((deliveryNoteId) => ({
              consolidatedSaleInvoiceId: id,
              sourceDeliveryNoteId: deliveryNoteId,
            })),
          });
        }
      }

      // Convert date strings to Date objects if provided
      const dataToUpdate: any = {
        ...updateData,
      };

      if (updateData.date) {
        dataToUpdate.date = new Date(updateData.date);
      }

      if (clientId) {
        dataToUpdate.clientId = clientId;
      }

      if (driverId !== undefined) {
        dataToUpdate.driverId = driverId;
      }

      if (shippingNoteId !== undefined) {
        dataToUpdate.shippingNoteId = shippingNoteId;
      }

      if (startDate !== undefined) {
        dataToUpdate.startDate = startDate ? new Date(startDate) : null;
      }

      if (endDate !== undefined) {
        dataToUpdate.endDate = endDate ? new Date(endDate) : null;
      }

      // Update the invoice
      return prisma.saleInvoice.update({
        where: { id },
        data: dataToUpdate,
        include: {
          client: true,
          driver: {
            include: {
              car: true,
            },
          },
          cities: {
            include: {
              city: true,
            },
          },
          items: {
            include: {
              product: true,
              shippingNoteItem: {
                include: {
                  product: true,
                  invoice: {
                    select: {
                      id: true,
                      invoiceNumber: true,
                      date: true,
                    },
                  },
                },
              },
            },
          },
          shippingNote: {
            include: {
              client: true,
              driver: true,
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
          deliveryNotes: true,
          // NEW: Include consolidated delivery notes
          consolidatedDeliveryNotes: {
            include: {
              sourceDeliveryNote: true,
            },
          },
        },
      });
    });
  }

  async updateStatus(id: number, updateStatusDto: UpdateStatusDto) {
    const invoice = await this.findOne(id);

    // Validate status transition
    this.validateStatusTransition(invoice.status, updateStatusDto.status);

    return this.prisma.$transaction(async (prisma) => {
      // If status is changing to VALIDATED, check stock availability
      if (
        updateStatusDto.status === InvoiceStatus.VALIDATED &&
        invoice.status !== InvoiceStatus.VALIDATED
      ) {
        // Check product stock
        for (const item of invoice.items) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`,
            );
          }

          //Delete this comment if the customer requests this condition.
          /* if (product.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for product ${product.name}. Available: ${product.stock}, Required: ${item.quantity}`,
            );
          } */
        }

        // Check shipping note item availability if this is a delivery note
        if (
          invoice.shippingNoteId &&
          invoice.type === SaleInvoiceType.DELIVERY_NOTE
        ) {
          const shippingNote = await prisma.saleInvoice.findUnique({
            where: { id: invoice.shippingNoteId },
            include: { items: true },
          });

          if (shippingNote) {
            for (const item of invoice.items) {
              if (item.shippingNoteItemId) {
                const shippingNoteItem = shippingNote.items.find(
                  (si) => si.id === item.shippingNoteItemId,
                );

                if (!shippingNoteItem) {
                  throw new NotFoundException(
                    `Shipping note item with ID ${item.shippingNoteItemId} not found`,
                  );
                }

                // Get total used from other VALIDATED delivery notes
                const otherDeliveryNotes = await prisma.saleInvoice.findMany({
                  where: {
                    shippingNoteId: invoice.shippingNoteId,
                    type: SaleInvoiceType.DELIVERY_NOTE,
                    id: { not: id },
                    status: InvoiceStatus.VALIDATED,
                  },
                  include: { items: true },
                });

                const totalUsedFromOthers = otherDeliveryNotes.reduce(
                  (total, note) => {
                    const matchingItem = note.items.find(
                      (ni) => ni.shippingNoteItemId === item.shippingNoteItemId,
                    );
                    return total + (matchingItem?.quantity || 0);
                  },
                  0,
                );

                const availableQuantity =
                  shippingNoteItem.quantity - totalUsedFromOthers;

                if (item.quantity > availableQuantity) {
                  throw new BadRequestException(
                    `Insufficient quantity in shipping note. Available: ${availableQuantity}, Requested: ${item.quantity}`,
                  );
                }
              }
            }
          }
        }
      }

      // Update the status
      const updatedInvoice = await prisma.saleInvoice.update({
        where: { id },
        data: {
          status: updateStatusDto.status,
        },
        include: {
          client: true,
          driver: true,
          cities: {
            include: {
              city: true,
            },
          },
          items: {
            include: {
              product: true,
              shippingNoteItem: true,
            },
          },
          shippingNote: true,
          deliveryNotes: true,
          // NEW: Include consolidated delivery notes
          consolidatedDeliveryNotes: {
            include: {
              sourceDeliveryNote: true,
            },
          },
        },
      });

      // If status is changing to VALIDATED, decrement stock and update shipping note items
      if (
        updateStatusDto.status === InvoiceStatus.VALIDATED &&
        invoice.status !== InvoiceStatus.VALIDATED
      ) {
        // Decrement product stock for sale invoices
        if (
          invoice.type === SaleInvoiceType.SALE_INVOICE ||
          invoice.type === SaleInvoiceType.DELIVERY_NOTE ||
          invoice.type === SaleInvoiceType.SHIPPING_NOTE_INVOICE
        ) {
          for (const item of invoice.items) {
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });
          }
        }

        // Update shipping note items quantity if this is a delivery note
        if (
          invoice.shippingNoteId &&
          invoice.type === SaleInvoiceType.DELIVERY_NOTE
        ) {
          for (const item of invoice.items) {
            if (item.shippingNoteItemId) {
              await prisma.saleInvoiceItem.update({
                where: { id: item.shippingNoteItemId },
                data: {
                  quantity: {
                    decrement: item.quantity,
                  },
                },
              });
            }
          }
        }
      }

      // If status is changing from VALIDATED to something else (DRAFT, CANCELLED), restore stock
      if (
        invoice.status === InvoiceStatus.VALIDATED &&
        updateStatusDto.status !== InvoiceStatus.VALIDATED
      ) {
        // Restore product stock
        if (
          invoice.type === SaleInvoiceType.SALE_INVOICE ||
          invoice.type === SaleInvoiceType.DELIVERY_NOTE ||
          invoice.type === SaleInvoiceType.SHIPPING_NOTE_INVOICE
        ) {
          for (const item of invoice.items) {
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });
          }
        }

        // Restore shipping note items quantity
        if (
          invoice.shippingNoteId &&
          invoice.type === SaleInvoiceType.DELIVERY_NOTE
        ) {
          for (const item of invoice.items) {
            if (item.shippingNoteItemId) {
              await prisma.saleInvoiceItem.update({
                where: { id: item.shippingNoteItemId },
                data: {
                  quantity: {
                    increment: item.quantity,
                  },
                },
              });
            }
          }
        }
      }

      return updatedInvoice;
    });
  }

  private validateStatusTransition(
    currentStatus: InvoiceStatus,
    newStatus: InvoiceStatus,
  ) {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      [InvoiceStatus.DRAFT]: [InvoiceStatus.VALIDATED, InvoiceStatus.CANCELLED],
      [InvoiceStatus.VALIDATED]: [
        InvoiceStatus.PAID,
        InvoiceStatus.CANCELLED,
        InvoiceStatus.DRAFT,
        InvoiceStatus.CLOSED, // Add CLOSED as a valid transition from VALIDATED
      ],
      [InvoiceStatus.PAID]: [InvoiceStatus.CANCELLED],
      [InvoiceStatus.CANCELLED]: [InvoiceStatus.DRAFT],
      [InvoiceStatus.CLOSED]: [], // CLOSED is a final state, no transitions from it
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  async remove(id: number) {
    const invoice = await this.findOne(id);

    return this.prisma.$transaction(async (prisma) => {
      // NEW: Delete delivery note consolidations first
      await prisma.deliveryNoteConsolidation.deleteMany({
        where: {
          OR: [{ consolidatedSaleInvoiceId: id }, { sourceDeliveryNoteId: id }],
        },
      });

      // Only restore stock if the invoice was VALIDATED
      /* if (invoice.status === InvoiceStatus.VALIDATED) {
        // Restore shipping note item quantities if this is a delivery note
        if (
          invoice.shippingNoteId &&
          invoice.type === SaleInvoiceType.DELIVERY_NOTE
        ) {
          for (const item of invoice.items) {
            if (item.shippingNoteItemId) {
              await prisma.saleInvoiceItem.update({
                where: { id: item.shippingNoteItemId },
                data: {
                  quantity: {
                    increment: item.quantity,
                  },
                },
              });
            }
          }
        }

        // Restore product stock for sale invoices
        if (
          invoice.type === SaleInvoiceType.SALE_INVOICE ||
          invoice.type === SaleInvoiceType.DELIVERY_NOTE ||
          invoice.type === SaleInvoiceType.SHIPPING_NOTE_INVOICE
        ) {
          for (const item of invoice.items) {
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });
          }
        }
      } */
      // Only restore stock if the invoice was VALIDATED
      if (invoice.status === InvoiceStatus.VALIDATED) {
        // For SALE_INVOICE type, only restore stock if it has no consolidated delivery notes
        if (invoice.type === SaleInvoiceType.SALE_INVOICE) {
          const hasConsolidatedDeliveryNotes =
            invoice.consolidatedDeliveryNotes &&
            invoice.consolidatedDeliveryNotes.length > 0;

          if (!hasConsolidatedDeliveryNotes) {
            // Restore product stock for SALE_INVOICE without consolidated delivery notes
            for (const item of invoice.items) {
              await prisma.product.update({
                where: { id: item.productId },
                data: {
                  stock: {
                    increment: item.quantity,
                  },
                },
              });
            }
          }
        } else if (
          invoice.type === SaleInvoiceType.DELIVERY_NOTE ||
          invoice.type === SaleInvoiceType.SHIPPING_NOTE_INVOICE
        ) {
          // Restore product stock for other invoice types
          for (const item of invoice.items) {
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  increment: item.quantity,
                },
              },
            });
          }
        }

        // Restore shipping note item quantities if this is a delivery note
        if (
          invoice.shippingNoteId &&
          invoice.type === SaleInvoiceType.DELIVERY_NOTE
        ) {
          for (const item of invoice.items) {
            if (item.shippingNoteItemId) {
              await prisma.saleInvoiceItem.update({
                where: { id: item.shippingNoteItemId },
                data: {
                  quantity: {
                    increment: item.quantity,
                  },
                },
              });
            }
          }
        }
      }

      // Delete city associations
      await prisma.saleInvoiceCity.deleteMany({
        where: { saleInvoiceId: id },
      });

      // Delete all items
      await prisma.saleInvoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Delete the invoice
      return prisma.saleInvoice.delete({
        where: { id },
      });
    });
  }

  async getStatistics() {
    const [
      totalInvoices,
      totalAmount,
      draftInvoices,
      validatedInvoices,
      paidInvoices,
      cancelledInvoices,
      monthlyStats,
      typeStats,
    ] = await Promise.all([
      this.prisma.saleInvoice.count(),
      this.prisma.saleInvoice.aggregate({
        _sum: {
          totalTTC: true,
        },
      }),
      this.prisma.saleInvoice.count({
        where: { status: InvoiceStatus.DRAFT },
      }),
      this.prisma.saleInvoice.count({
        where: { status: InvoiceStatus.VALIDATED },
      }),
      this.prisma.saleInvoice.count({
        where: { status: InvoiceStatus.PAID },
      }),
      this.prisma.saleInvoice.count({
        where: { status: InvoiceStatus.CANCELLED },
      }),
      this.prisma.saleInvoice.groupBy({
        by: ['date'],
        _sum: {
          totalTTC: true,
        },
        where: {
          date: {
            gte: new Date(
              new Date().getFullYear(),
              new Date().getMonth() - 11,
              1,
            ),
          },
        },
        orderBy: {
          date: 'asc',
        },
      }),
      this.prisma.saleInvoice.groupBy({
        by: ['type'],
        _count: true,
        _sum: {
          totalTTC: true,
        },
      }),
    ]);

    return {
      totalInvoices,
      totalAmount: totalAmount._sum.totalTTC || 0,
      byStatus: {
        draft: draftInvoices,
        validated: validatedInvoices,
        paid: paidInvoices,
        cancelled: cancelledInvoices,
      },
      byType: typeStats,
      monthlyStats,
    };
  }

  async getAvailableDrivers() {
    const drivers = await this.prisma.driver.findMany({
      where: { active: true },
      include: {
        car: true,
        saleInvoices: {
          where: {
            status: {
              in: [InvoiceStatus.DRAFT, InvoiceStatus.VALIDATED],
            },
          },
        },
      },
    });

    return drivers.map((driver) => ({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      fullName: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone,
      cin: driver.cin,
      licenseNumber: driver.licenseNumber,
      active: driver.active,
      currentAssignments: driver.saleInvoices.length,
      car: driver.car
        ? {
            id: driver.car.id,
            registration: driver.car.registration,
            brand: driver.car.brand,
            model: driver.car.model,
          }
        : null,
    }));
  }

  async getDeliveryNotesForShippingNote(shippingNoteId: number) {
    const shippingNote = await this.prisma.saleInvoice.findUnique({
      where: { id: shippingNoteId },
    });

    if (!shippingNote) {
      throw new NotFoundException(
        `Shipping note with ID ${shippingNoteId} not found`,
      );
    }

    return this.prisma.saleInvoice.findMany({
      where: {
        shippingNoteId: shippingNoteId,
        type: SaleInvoiceType.DELIVERY_NOTE,
      },
      include: {
        client: true,
        driver: true,
        items: {
          include: {
            product: true,
            shippingNoteItem: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  async getShippingNoteRemainingQuantities(shippingNoteId: number) {
    const shippingNote = await this.prisma.saleInvoice.findUnique({
      where: { id: shippingNoteId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!shippingNote) {
      throw new NotFoundException(
        `Shipping note with ID ${shippingNoteId} not found`,
      );
    }

    // Get all VALIDATED delivery notes that reference this shipping note
    const deliveryNotes = await this.prisma.saleInvoice.findMany({
      where: {
        shippingNoteId: shippingNoteId,
        type: SaleInvoiceType.DELIVERY_NOTE,
        status: InvoiceStatus.VALIDATED,
      },
      include: {
        items: true,
      },
    });

    // Calculate remaining quantities
    const remainingQuantities = shippingNote.items.map((item) => {
      const deliveredQuantity = deliveryNotes.reduce((total, note) => {
        const matchingItem = note.items.find(
          (ni) => ni.shippingNoteItemId === item.id,
        );
        return total + (matchingItem?.quantity || 0);
      }, 0);

      return {
        itemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        originalQuantity: item.quantity,
        deliveredQuantity,
        remainingQuantity: item.quantity - deliveredQuantity,
      };
    });

    return remainingQuantities;
  }

  async getItemTraceability(itemId: number) {
    const item = await this.prisma.saleInvoiceItem.findUnique({
      where: { id: itemId },
      include: {
        product: true,
        invoice: {
          include: {
            client: true,
            driver: true,
          },
        },
        shippingNoteItem: {
          include: {
            product: true,
            invoice: {
              include: {
                client: true,
                driver: true,
              },
            },
            derivedItems: {
              include: {
                invoice: {
                  include: {
                    client: true,
                  },
                },
              },
            },
          },
        },
        derivedItems: {
          include: {
            invoice: {
              include: {
                client: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Sale invoice item with ID ${itemId} not found`,
      );
    }

    return item;
  }

  async generatePdf(id: number) {
    const invoice = await this.findOne(id);
    return { message: 'PDF generation endpoint', invoiceId: id };
  }

  async sendByEmail(
    id: number,
    emailData: { to: string; subject?: string; message?: string },
  ) {
    const invoice = await this.findOne(id);
    return { message: 'Email sent', invoiceId: id, to: emailData.to };
  }

  // NEW: Helper method to get available delivery notes for consolidation
  async getAvailableDeliveryNotesForConsolidation(clientId?: number) {
    const where: Prisma.SaleInvoiceWhereInput = {
      type: SaleInvoiceType.DELIVERY_NOTE,
      status: InvoiceStatus.VALIDATED,
    };

    if (clientId) {
      where.clientId = clientId;
    }

    // Exclude delivery notes that are already consolidated
    const consolidatedDeliveryNotes =
      await this.prisma.deliveryNoteConsolidation.findMany({
        select: {
          sourceDeliveryNoteId: true,
        },
      });

    const consolidatedIds = consolidatedDeliveryNotes.map(
      (c) => c.sourceDeliveryNoteId,
    );

    if (consolidatedIds.length > 0) {
      where.id = {
        notIn: consolidatedIds,
      };
    }

    return this.prisma.saleInvoice.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async getUnpaidDeliveryInvoicesForCustomerAndDriver(
    clientId: number,
    driverId: number,
  ) {
    // First verify that the client exists
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Verify that the driver exists
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    // Get all delivery notes for this client and driver
    const deliveryInvoices = await this.prisma.saleInvoice.findMany({
      where: {
        clientId: clientId,
        driverId: driverId,
        type: SaleInvoiceType.DELIVERY_NOTE,
        status: {
          in: [InvoiceStatus.VALIDATED, InvoiceStatus.PAID], // Only consider validated or paid invoices
        },
      },
      include: {
        payments: true, // Include payments to calculate total paid
        items: {
          include: {
            product: true,
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
        driver: {
          include: {
            car: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Filter invoices where totalTTC > total payments
    const unpaidInvoices = deliveryInvoices.filter((invoice) => {
      const totalPayments = invoice.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      return invoice.totalTTC > totalPayments;
    });

    // Calculate additional information for each invoice
    const result = unpaidInvoices.map((invoice) => {
      const totalPayments = invoice.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const remainingAmount = invoice.totalTTC - totalPayments;

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        type: invoice.type,
        status: invoice.status,
        totalHT: invoice.totalHT,
        totalTTC: invoice.totalTTC,
        taxStamp: invoice.taxStamp,
        totalPayments,
        remainingAmount,
        paymentStatus: remainingAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        client: invoice.client,
        driver: invoice.driver,
        items: invoice.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.price,
          vatRate: item.vatRate,
          vatAmount: item.vatAmount,
          totalHT: item.price * item.quantity,
          totalTTC: item.price * item.quantity * (1 + item.vatRate / 100),
        })),
        payments: invoice.payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          createdAt: payment.createdAt,
        })),
      };
    });

    return {
      clientId,
      clientName: client.name,
      driverId,
      driverName: `${driver.firstName} ${driver.lastName}`,
      totalUnpaidInvoices: result.length,
      totalUnpaidAmount: result.reduce(
        (sum, inv) => sum + inv.remainingAmount,
        0,
      ),
      invoices: result,
    };
  }

  // Also add a more flexible version with optional parameters
  async getUnpaidDeliveryInvoices(clientId?: number, driverId?: number) {
    const where: Prisma.SaleInvoiceWhereInput = {
      type: SaleInvoiceType.DELIVERY_NOTE,
      status: {
        in: [InvoiceStatus.VALIDATED, InvoiceStatus.PAID],
      },
    };

    if (clientId) {
      where.clientId = clientId;
    }

    if (driverId) {
      where.driverId = driverId;
    }

    const deliveryInvoices = await this.prisma.saleInvoice.findMany({
      where,
      include: {
        payments: true,
        items: {
          include: {
            product: true,
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
        driver: {
          include: {
            car: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Filter and enrich invoices
    const unpaidInvoices = deliveryInvoices
      .filter((invoice) => {
        const totalPayments = invoice.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        return invoice.totalTTC > totalPayments;
      })
      .map((invoice) => {
        const totalPayments = invoice.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        const remainingAmount = invoice.totalTTC - totalPayments;

        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          client: invoice.client,
          driver: invoice.driver,
          totalTTC: invoice.totalTTC,
          totalPayments,
          remainingAmount,
          status: invoice.status,
          paymentMethod: invoice.payments[0]?.method || null,
        };
      });

    return unpaidInvoices;
  }

  // Add this method to your SaleInvoiceService class
  async generateInvoiceNumber0(type?: SaleInvoiceType) {
    const currentYear = new Date().getFullYear();
    const yearPrefix = currentYear.toString().slice(-2); // Get last 2 digits of year

    // Add type prefix to differentiate invoice types
    let typePrefix = '';
    switch (type) {
      case SaleInvoiceType.SALE_INVOICE:
        typePrefix = 'S';
        break;
      case SaleInvoiceType.DELIVERY_NOTE:
        typePrefix = 'D';
        break;
      case SaleInvoiceType.SHIPPING_NOTE_INVOICE:
        typePrefix = 'SH';
        break;
      default:
        typePrefix = 'I'; // Default prefix for unspecified type
    }

    // Construct the search pattern based on type
    let searchPattern: string;
    if (type) {
      // With type prefix: e.g., "25S" for SALE_INVOICE, "25D" for DELIVERY_NOTE, "25SH" for SHIPPING_NOTE_INVOICE
      searchPattern = `${yearPrefix}${typePrefix}`;
    } else {
      // Without type prefix (backward compatibility)
      searchPattern = yearPrefix;
    }

    // Find the highest invoice number for the current year and type
    const latestInvoice = await this.prisma.saleInvoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: searchPattern,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let nextNumber = 1;

    if (latestInvoice && latestInvoice.invoiceNumber) {
      // Extract the numeric part after the prefix
      const prefixLength = type
        ? type === SaleInvoiceType.SHIPPING_NOTE_INVOICE
          ? 4
          : 3
        : 3;
      const numericPart = latestInvoice.invoiceNumber.slice(prefixLength);
      const currentNumber = parseInt(numericPart, 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    // Format: year prefix + type prefix + 5-digit number (padded with zeros)
    const sequentialNumber = nextNumber.toString().padStart(5, '0');
    let invoiceNumber: string;

    if (type) {
      invoiceNumber = `${yearPrefix}${typePrefix}${sequentialNumber}`;
    } else {
      // Backward compatibility
      invoiceNumber = `${yearPrefix}${sequentialNumber}`;
    }

    return invoiceNumber;
  }

  async generateInvoiceNumber(type: SaleInvoiceType) {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    // Find the last invoice for this type that was created in the current year
    const lastInvoice = await this.prisma.saleInvoice.findFirst({
      where: {
        type: type,
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    let nextNumber = 1;

    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Extract the numeric part from invoice number format "0036/2026"
      const match = lastInvoice.invoiceNumber.match(/^(\d{4})\/\d{4}$/);

      if (match) {
        const lastNumber = parseInt(match[1], 10);
        nextNumber = lastNumber + 1;
      } else {
        nextNumber = parseInt(lastInvoice.invoiceNumber) + 1;
      }
    }

    // Format as 4 digits with leading zeros like "0037"
    const formattedNumber = nextNumber.toString().padStart(4, '0');
    return formattedNumber;
    /* return {
      type: type,
      nextInvoiceNumber: formattedNumber,
    }; */
  }
}
