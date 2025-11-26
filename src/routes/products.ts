import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
// Validation schemas
const packagingOptionSchema = z.object({
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
});

const createProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    price: z.number().positive(),
    msrp: z.number().positive().optional(),
    sku: z.string().min(1),
    stock: z.number().int().min(0),
    categoryId: z.string().min(1),
    image: z.string().optional(),
    images: z.array(z.string()).optional(),
    specifications: z.record(z.string(), z.string()).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    tags: z.array(z.string()).optional(),
    filterOptionIds: z.array(z.string()).optional(),
    packagingOptions: z.array(packagingOptionSchema).optional(),
    hsnCode: z.string().optional(),
    taxRate: z.number().optional(),
});

// Get all products (with optional category and filter filtering)
router.get('/', async (req, res) => {
    try {
        const { categoryId, filterOptionIds } = req.query;

        const where: any = {};
        if (categoryId) where.categoryId = String(categoryId);

        if (filterOptionIds) {
            const ids = String(filterOptionIds).split(',');
            where.filterOptions = {
                some: {
                    id: { in: ids }
                }
            };
        }

        const products = await prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                category: true,
                packagingOptions: true,
                filterOptions: {
                    include: {
                        filterGroup: true
                    }
                }
            },
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                packagingOptions: true,
                filterOptions: {
                    include: {
                        filterGroup: true
                    }
                }
            },
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Create a new product (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const validatedData = createProductSchema.parse(req.body);
        const { filterOptionIds, categoryId, packagingOptions, ...rest } = validatedData;

        const product = await prisma.product.create({
            data: {
                ...rest,
                category: {
                    connect: { id: categoryId }
                },
                filterOptions: filterOptionIds ? {
                    connect: filterOptionIds.map(id => ({ id }))
                } : undefined,
                packagingOptions: packagingOptions ? {
                    create: packagingOptions
                } : undefined
            },
            include: {
                packagingOptions: true,
                filterOptions: {
                    include: {
                        filterGroup: true
                    }
                }
            }
        });
        res.status(201).json(product);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Failed to create product' });
        }
    }
});

// Update a product (Admin only)
router.put('/:id', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const validatedData = createProductSchema.partial().parse(req.body);
        const { filterOptionIds, categoryId, packagingOptions, ...rest } = validatedData;

        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: {
                ...rest,
                category: categoryId ? {
                    connect: { id: categoryId }
                } : undefined,
                filterOptions: filterOptionIds ? {
                    set: filterOptionIds.map(id => ({ id }))
                } : undefined,
                packagingOptions: packagingOptions ? {
                    deleteMany: {},
                    create: packagingOptions
                } : undefined
            },
            include: {
                packagingOptions: true,
                filterOptions: {
                    include: {
                        filterGroup: true
                    }
                }
            }
        });
        res.json(product);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues });
        } else {
            console.error(error);
            res.status(500).json({ error: 'Failed to update product' });
        }
    }
});

// Delete product (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.product.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

export default router;
