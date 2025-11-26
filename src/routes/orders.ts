import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Validation Schema
const orderItemSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    packagingName: z.string().optional(),
    unitsPerPackage: z.number().int().optional(),
    packagingOptionId: z.string().uuid().optional(),
});

const createOrderSchema = z.object({
    items: z.array(orderItemSchema).min(1),
});

// POST /orders - Place a new order (Authenticated users)
router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
        const { items } = createOrderSchema.parse(req.body);
        const user = (req as any).user;

        // Transaction to ensure inventory consistency
        const result = await prisma.$transaction(async (prisma) => {
            let subtotal = 0;
            const orderItemsData = [];

            // Fetch user to get billing state
            const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
            const userState = fullUser?.billingState?.toLowerCase();
            const adminState = 'gujarat'; // Hardcoded as per plan

            for (const item of items) {
                const product = await prisma.product.findUnique({ where: { id: item.productId } });

                if (!product) {
                    throw new Error(`Product not found: ${item.productId}`);
                }

                // Determine price and units based on packaging
                let price = product.price;
                let unitsPerPackage = 1;
                let packagingName = 'Unit';

                if (item.packagingOptionId) {
                    const packagingOption = await prisma.packagingOption.findUnique({
                        where: { id: item.packagingOptionId }
                    });

                    if (packagingOption && packagingOption.productId === item.productId) {
                        price = packagingOption.price;
                        unitsPerPackage = packagingOption.quantity;
                        packagingName = packagingOption.name;
                    }
                } else if (item.packagingName === 'Unit') {
                    // Explicit unit
                    unitsPerPackage = 1;
                    packagingName = 'Unit';
                } else {
                    // Defaulting to Unit price
                }

                // Calculate total units to deduct
                const unitsToDeduct = item.quantity * unitsPerPackage;

                if (product.stock < unitsToDeduct) {
                    throw new Error(`Insufficient stock for product: ${product.name}`);
                }

                // Decrement stock
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: product.stock - unitsToDeduct },
                });

                const itemTotal = Number(price) * item.quantity;
                subtotal += itemTotal;

                orderItemsData.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: price,
                    taxRate: product.taxRate, // Snapshot tax rate
                    hsnCode: product.hsnCode,
                    packagingName: packagingName,
                    unitsPerPackage: unitsPerPackage
                });
            }

            // Tax Calculation
            let taxAmount = 0;
            let taxType = 'IGST';

            if (userState === adminState) {
                taxType = 'CGST_SGST';
            }

            // Calculate total tax (assuming flat 18% for now or using product specific if we want to be precise, 
            // but for MVP let's calculate on subtotal if all products are 18%, 
            // OR better: sum up tax for each item. Let's do sum up for accuracy)

            // Re-calculating tax per item to be precise
            let totalTax = 0;
            for (const itemData of orderItemsData) {
                const itemPrice = Number(itemData.price) * itemData.quantity;
                const itemTax = itemPrice * (Number(itemData.taxRate) / 100);
                totalTax += itemTax;
            }

            const grandTotal = subtotal + totalTax;

            // Create Order
            const order = await prisma.order.create({
                data: {
                    userId: user.id,
                    companyId: user.companyId,
                    total: grandTotal,
                    taxAmount: totalTax,
                    taxType: taxType,
                    items: {
                        create: orderItemsData,
                    },
                },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                },
            });

            return order;
        });

        res.status(201).json(result);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        if (error.message.includes('Insufficient inventory') || error.message.includes('Product not found')) {
            return res.status(400).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /orders - List orders (Admin sees all, Client sees theirs)
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        let whereClause = {};
        if (user.role !== 'ADMIN') {
            whereClause = { companyId: user.companyId };
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                user: {
                    select: {
                        email: true,
                    },
                },
                company: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status (Admin only)
router.put('/:id/status', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await prisma.order.update({
            where: { id },
            data: { status },
            include: {
                items: {
                    include: {
                        product: true,
                    },
                },
                user: {
                    select: {
                        email: true,
                    },
                },
                company: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

export default router;
