import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@b2b.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const company = await prisma.company.upsert({
        where: { name: 'Kalptaru Wholesale' },
        update: {},
        create: {
            name: 'Kalptaru Wholesale',
        },
    });

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'ADMIN',
        },
        create: {
            email,
            password: hashedPassword,
            role: 'ADMIN',
            companyId: company.id,
        },
    });

    // Create Category
    const category = await prisma.category.upsert({
        where: { name: 'Electronics' },
        update: {},
        create: {
            name: 'Electronics',
            slug: 'electronics',
        },
    });

    // Create Product with Packaging Options
    const product = await prisma.product.upsert({
        where: { sku: 'USB-C-CABLE-1M' },
        update: {},
        create: {
            name: 'Premium USB-C Cable 1m',
            description: 'High-speed charging and data transfer cable.',
            price: 5.99,
            msrp: 12.99,
            sku: 'USB-C-CABLE-1M',
            stock: 1000,
            categoryId: category.id,
            images: ['https://placehold.co/600x400?text=USB-C+Cable'],
            packagingOptions: {
                create: [
                    { name: 'Inner Box', quantity: 10, price: 55.00 }, // $5.50/unit
                    { name: 'Master Carton', quantity: 100, price: 500.00 }, // $5.00/unit
                ],
            },
        },
    });

    console.log({ company, user, category, product });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
