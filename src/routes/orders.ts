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
            let total = 0;
            const orderItemsData = [];

            for (const item of items) {
                const product = await prisma.product.findUnique({ where: { id: item.productId } });

                if (!product) {
                    throw new Error(`Product not found: ${item.productId}`);
                }

                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product: ${product.name}`);
                }

                // Decrement stock
                await prisma.product.update({
                    where: { id: item.productId },
                    data: { stock: product.stock - item.quantity },
                });

                total += Number(product.price) * item.quantity;
                orderItemsData.push({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: product.price,
                });
            }

            // Create Order
            const order = await prisma.order.create({
                data: {
                    userId: user.id,
                    companyId: user.companyId,
                    total: total,
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
