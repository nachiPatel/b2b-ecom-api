import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createFilterGroupSchema = z.object({
    name: z.string().min(1),
});

const createFilterOptionSchema = z.object({
    value: z.string().min(1),
});

// Get all filter groups with options
router.get('/', async (req, res) => {
    try {
        const filterGroups = await prisma.filterGroup.findMany({
            include: {
                options: true,
            },
            orderBy: { name: 'asc' },
        });
        res.json(filterGroups);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch filters' });
    }
});

// Create filter group (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const { name } = createFilterGroupSchema.parse(req.body);

        const filterGroup = await prisma.filterGroup.create({
            data: { name },
            include: { options: true },
        });
        res.status(201).json(filterGroup);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to create filter group' });
    }
});

// Add option to filter group (Admin only)
router.post('/:id/options', authenticate, authorize(['ADMIN']), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { value } = createFilterOptionSchema.parse(req.body);

        const option = await prisma.filterOption.create({
            data: {
                value,
                filterGroupId: id,
            },
        });
        res.status(201).json(option);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Failed to create filter option' });
    }
});

// Delete filter group (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.filterGroup.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete filter group' });
    }
});

// Delete filter option (Admin only)
router.delete('/options/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.filterOption.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete filter option' });
    }
});

export default router;
