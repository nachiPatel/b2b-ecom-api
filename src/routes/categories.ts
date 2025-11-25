import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const createCategorySchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
});

// Update category (Admin only)
router.put('/:id', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, slug, filterGroupIds } = z.object({
            name: z.string().min(1).optional(),
            slug: z.string().min(1).optional(),
            filterGroupIds: z.array(z.string()).optional(),
        }).parse(req.body);

        const data: any = {};
        if (name) data.name = name;
        if (slug) data.slug = slug;
        if (filterGroupIds) {
            data.filterGroups = {
                set: filterGroupIds.map(id => ({ id })),
            };
        }

        const category = await prisma.category.update({
            where: { id },
            data,
            include: { filterGroups: true },
        });

        res.json(category);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Get all categories (updated to include filterGroups and their options)
router.get('/', async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
            include: {
                filterGroups: {
                    include: {
                        options: true
                    }
                }
            },
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create category (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { name, slug } = createCategorySchema.parse(req.body);

        const category = await prisma.category.create({
            data: { name, slug },
            include: { filterGroups: true },
        });

        res.status(201).json(category);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.issues });
        } else {
            res.status(500).json({ error: 'Failed to create category' });
        }
    }
});

// Delete category (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.category.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

export default router;
