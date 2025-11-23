import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Validation Schemas
const registerSchema = z.object({
    companyName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

// Register Endpoint
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { companyName, email, password } = registerSchema.parse(req.body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create Company and Admin User in transaction
        const result = await prisma.$transaction(async (prisma) => {
            const company = await prisma.company.create({
                data: { name: companyName },
            });

            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: 'ADMIN',
                    companyId: company.id,
                },
            });

            return { company, user };
        });

        res.status(201).json({ message: 'Company and Admin created successfully', companyId: result.company.id });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login Endpoint
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, companyId: user.companyId },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ token, user: { id: user.id, email: user.email, role: user.role, companyId: user.companyId } });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
