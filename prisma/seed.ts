import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

/**
 * Database Seed Script (INFRA-003)
 *
 * Seeds a clean, predictable demo seller ("habesha-cafe"), 3 catalog products,
 * and an initial sample order for immediate testing of storefront and checkout.
 *
 * SAFETY GUARDS:
 * 1. Strictly forbidden in production environments (NODE_ENV === "production").
 * 2. Idempotent: running multiple times never duplicates rows.
 * 3. Never overwrites existing seller phone numbers, verification status, or passwords.
 *
 * DEMO CREDENTIALS NOTICE:
 * The demo credentials (HabeshaDemo2026!, 0911223344) are strictly intended
 * for local development and offline automated testing. Never use in production.
 *
 * References: docs/07 (Sec 10.4), docs/13 (Sec 16.3).
 */

export const DEMO_SELLER = {
  business_name: "Habesha Cafe & Bakery",
  sms_name: "Habesha Cafe",
  slug: "habesha-cafe",
  phone: "0911223344",
  password_plain: "HabeshaDemo2026!",
};

export const DEMO_PRODUCTS = [
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
  // Production Safety Guard: Immediately reject execution in production before any DB operations
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Production safety guard: Database seeding is strictly forbidden in production environments."
    );
  }

  const prisma = prismaClient ?? new PrismaClient();

  try {
    console.log("🌱 Seeding database (Development/Test Mode)...");

    // 1. Seed demo seller safely without overwriting existing credentials
    let seller = await prisma.seller.findUnique({
      where: { slug: DEMO_SELLER.slug },
    });

    if (seller) {
      console.log(
        `✔ Existing seller '${seller.slug}' found. Preserving existing phone (${seller.phone}) and verification status.`
      );
    } else {
      const passwordHash = await hashPassword(DEMO_SELLER.password_plain);

      seller = await prisma.seller.create({
        data: {
          business_name: DEMO_SELLER.business_name,
          sms_name: DEMO_SELLER.sms_name,
          slug: DEMO_SELLER.slug,
          phone: DEMO_SELLER.phone,
          phone_verified_at: new Date("2026-10-18T00:00:00Z"),
          password_hash: passwordHash,
        },
      });

      console.log(`✔ Created demo seller: ${seller.business_name} (/s/${seller.slug})`);
    }

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
