import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Validation Schemas
const productSchema = z.object({
    name: z.string().min(1),
    description: z.string(),
    price: z.number().positive(),
    sku: z.string().min(1),
    inventory: z.number().int().nonnegative(),
});

// GET /products - List all products (Authenticated users)
router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
        const products = await prisma.product.findMany();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /products - Create a product (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const { name, description, price, sku, inventory } = productSchema.parse(req.body);

        const existingProduct = await prisma.product.findUnique({ where: { sku } });
        if (existingProduct) {
            return res.status(400).json({ error: 'Product with this SKU already exists' });
        }

        const product = await prisma.product.create({
            data: {
                name,
                description,
                price,
                sku,
                inventory,
            },
        });

        res.status(201).json(product);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /products/:id - Update a product (Admin only)
router.put('/:id', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, price, sku, inventory } = productSchema.parse(req.body);

        const product = await prisma.product.update({
            where: { id },
            data: {
                name,
                description,
                price,
                sku,
                inventory,
            },
        });

        res.json(product);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /products/:id - Delete a product (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.product.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
