import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

/**
 * Database Seed Script (INFRA-003)
 *
 * Seeds a clean, predictable demo seller ("habesha-cafe"), 3 catalog products,
 * and an initial sample order for immediate testing of storefront and checkout.
 * Designed to be completely idempotent: running multiple times never duplicates rows.
 *
 * References: docs/07 (Sec 10.4), docs/13 (Sec 16.3).
 */

const DEMO_SELLER = {
  business_name: "Habesha Cafe & Bakery",
  sms_name: "Habesha Cafe",
  slug: "habesha-cafe",
  phone: "0911223344",
  password_plain: "HabeshaDemo2026!",
};

const DEMO_PRODUCTS = [
  {
    name: "Special Combo Platter",
    price_santim: 35000, // 350.00 Birr
    available: true,
  },
  {
    name: "Traditional Spiced Tea",
    price_santim: 5000, // 50.00 Birr
    available: true,
  },
  {
    name: "Fresh Roasted Coffee (1kg)",
    price_santim: 60000, // 600.00 Birr
    available: true,
  },
];

export async function seedDatabase(prismaClient?: PrismaClient) {
  const prisma = prismaClient ?? new PrismaClient();

  try {
    console.log("🌱 Seeding database...");

    // 1. Seed or update demo seller
    const passwordHash = await hashPassword(DEMO_SELLER.password_plain);

    const seller = await prisma.seller.upsert({
      where: { slug: DEMO_SELLER.slug },
      update: {
        business_name: DEMO_SELLER.business_name,
        sms_name: DEMO_SELLER.sms_name,
        phone: DEMO_SELLER.phone,
        phone_verified_at: new Date("2026-10-18T00:00:00Z"),
      },
      create: {
        business_name: DEMO_SELLER.business_name,
        sms_name: DEMO_SELLER.sms_name,
        slug: DEMO_SELLER.slug,
        phone: DEMO_SELLER.phone,
        phone_verified_at: new Date("2026-10-18T00:00:00Z"),
        password_hash: passwordHash,
      },
    });

    console.log(`✔ Demo seller: ${seller.business_name} (/s/${seller.slug})`);

    // 2. Seed or update demo products
    for (const prod of DEMO_PRODUCTS) {
      const existing = await prisma.product.findFirst({
        where: {
          seller_id: seller.id,
          name: prod.name,
        },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            price_santim: prod.price_santim,
            available: prod.available,
          },
        });
      } else {
        await prisma.product.create({
          data: {
            seller_id: seller.id,
            name: prod.name,
            price_santim: prod.price_santim,
            available: prod.available,
          },
        });
      }
    }

    console.log(`✔ Demo products: ${DEMO_PRODUCTS.length} products verified`);

    // 3. Seed initial sample order (#1001) if not existing
    const existingOrder = await prisma.order.findUnique({
      where: {
        seller_id_number: {
          seller_id: seller.id,
          number: 1001,
        },
      },
    });

    if (!existingOrder) {
      await prisma.order.create({
        data: {
          seller_id: seller.id,
          number: 1001,
          buyer_name: "Abebe Bikila",
          buyer_phone: "0922334455",
          sms_consent: true,
          consent_wording: "I agree to receive order status updates via SMS",
          consent_at: new Date("2026-10-18T00:00:00Z"),
          state: "new",
          total_santim: 40000,
          order_items: {
            create: [
              {
                name_at_order: "Special Combo Platter",
                unit_price_santim: 35000,
                quantity: 1,
              },
              {
                name_at_order: "Traditional Spiced Tea",
                unit_price_santim: 5000,
                quantity: 1,
              },
            ],
          },
          order_events: {
            create: [
              {
                from_state: null,
                to_state: "new",
                actor: "buyer",
              },
            ],
          },
        },
      });
      console.log("✔ Sample order: Order #1001 created");
    } else {
      console.log("✔ Sample order: Order #1001 already exists (skipped)");
    }

    console.log("🎉 Database seed completed successfully.");

    return {
      seller,
      productsCount: DEMO_PRODUCTS.length,
      sampleOrderNumber: 1001,
    };
  } finally {
    if (!prismaClient) {
      await prisma.$disconnect();
    }
  }
}

// Auto-run if executed directly via CLI (tsx prisma/seed.ts)
const isDirectExecution =
  process.argv[1]?.includes("seed.ts") || process.argv[1]?.includes("seed");

if (isDirectExecution && !process.env.VITEST) {
  seedDatabase().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
}
