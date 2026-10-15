import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { MongoClient, Decimal128 } from "mongodb";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load backend .env if available
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "easy_shop";

if (!uri) {
  console.error("MONGODB_URI not found in environment or backend/.env");
  process.exit(1);
}

const derive = (password, salt) =>
  new Promise((res, rej) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? rej(err) : res(key)),
    );
  });

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

const DEMO_EMAIL = "demo@easyshop.com";
const DEMO_PASS = "DemoPassword123!";
const DEMO_NAME = "Demo Merchant";

const ADMIN_EMAIL = "admin@easyshop.britsyncai.com";

const DEMO_USER_ID = "d0000000-0000-4000-8000-000000000001";
const DEMO_SHOP_ID = "d0000000-0000-4000-8000-000000000002";
const DEMO_SUBDOMAIN = "demo-store";

async function seed() {
  console.log(`Connecting to MongoDB (${dbName})...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(DEMO_PASS);

  console.log(`Setting up demo merchant account: ${DEMO_EMAIL}`);
  await db.collection("users").updateOne(
    { email: DEMO_EMAIL },
    {
      $set: {
        _id: DEMO_USER_ID,
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        passwordHash,
        language: "en",
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // Also update existing admin user password if it exists so both work with DemoPassword123!
  const adminUser = await db.collection("users").findOne({ email: ADMIN_EMAIL });
  if (adminUser) {
    console.log(`Updating ${ADMIN_EMAIL} password to ${DEMO_PASS}...`);
    await db.collection("users").updateOne(
      { email: ADMIN_EMAIL },
      { $set: { passwordHash, updatedAt: now } }
    );
  }

  // Setup launched Demo Shop
  console.log(`Setting up demo shop: ${DEMO_SUBDOMAIN} (Easy Shop Studio)...`);
  await db.collection("shops").updateOne(
    { _id: DEMO_SHOP_ID },
    {
      $set: {
        ownerId: DEMO_USER_ID,
        displayName: "Easy Shop Studio",
        legalName: "Easy Shop Studio Ltd.",
        subdomain: DEMO_SUBDOMAIN,
        category: "Fashion & Lifestyle",
        country: "Bangladesh",
        currency: "BDT",
        language: "en",
        status: "launched",
        onboardingStep: "launch",
        selectedTemplateId: "test-fashion-basic",
        policyDefaults: {
          deliveryCharge: 60,
          returnDays: 7,
          codAllowed: true,
        },
        aiMode: "suggest",
        storefrontConfig: {
          theme: {
            accent: "#18181b",
            background: "#ffffff",
            text: "#18181b",
          },
          sections: ["hero", "products"],
          seo: {
            title: "Easy Shop Studio — Curated Essentials",
            description: "Timeless clothing, handcrafted canvas bags, and daily lifestyle essentials.",
          },
        },
        revision: 1,
        launchedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // Shop staff assignment
  await db.collection("shopStaff").updateOne(
    { shopId: DEMO_SHOP_ID, userId: DEMO_USER_ID },
    {
      $set: {
        role: "owner",
        status: "active",
        updatedAt: now,
      },
      $setOnInsert: {
        _id: randomUUID(),
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // If the old "demo" shop exists, also make sure DEMO_USER is associated as owner or staff
  const existingDemoShop = await db.collection("shops").findOne({ subdomain: "demo" });
  if (existingDemoShop) {
    await db.collection("shopStaff").updateOne(
      { shopId: existingDemoShop._id, userId: DEMO_USER_ID },
      {
        $set: { role: "owner", status: "active", updatedAt: now },
        $setOnInsert: { _id: randomUUID(), createdAt: now },
      },
      { upsert: true }
    );
  }

  // Products definition
  const demoProducts = [
    {
      id: "d0000001-0000-4000-8000-000000000001",
      name: "Everyday Olive Canvas Tote",
      slug: "everyday-olive-tote",
      sku: "TOT-OLV-001",
      category: "Bags & Accessories",
      description:
        "Handcrafted from 100% organic cotton duck canvas with reinforced shoulder straps and dual interior organizer pockets. Designed for daily commuting and weekend market runs.",
      price: 1250.0,
      image: "/images/olive-tote.webp",
      variants: [
        {
          id: "d0000002-0000-4000-8000-000000000001",
          title: "Standard / Olive Green",
          sku: "TOT-OLV-STD",
          stock: 24,
          price: 1250.0,
        },
      ],
      aiFacts: {
        sellingPoints: "Heavyweight 16oz cotton canvas, water-resistant base, reinforced box stitching on straps.",
        audience: "Urban commuters, students, professionals seeking durable minimalist carry.",
        care: "Spot clean with damp cloth and mild soap. Hang dry away from direct sunlight.",
        policyExceptions: "Full return or exchange within 7 days in unworn condition.",
      },
    },
    {
      id: "d0000001-0000-4000-8000-000000000002",
      name: "Relaxed Weekend Oxford Shirt",
      slug: "weekend-oxford-shirt",
      sku: "SHR-OXF-002",
      category: "Apparel",
      description:
        "Tailored from breathable combed cotton oxford fabric with a garment-washed finish for soft, relaxed drape. Features mother-of-pearl buttons and curved hemline.",
      price: 1850.0,
      image: "/images/weekend-shirt.svg",
      variants: [
        {
          id: "d0000002-0000-4000-8000-000000000002",
          title: "Chalk White / Medium",
          sku: "SHR-OXF-WHT-M",
          stock: 10,
          price: 1850.0,
        },
        {
          id: "d0000002-0000-4000-8000-000000000003",
          title: "Chalk White / Large",
          sku: "SHR-OXF-WHT-L",
          stock: 8,
          price: 1850.0,
        },
      ],
      aiFacts: {
        sellingPoints: "100% long-staple cotton, pre-shrunk, button-down collar, casual everyday fit.",
        audience: "Men and unisex buyers seeking classic versatile smart-casual shirts.",
        care: "Machine wash cold with like colors. Warm iron if needed.",
        policyExceptions: "Size exchange supported within 7 days.",
      },
    },
    {
      id: "d0000001-0000-4000-8000-000000000003",
      name: "Minimalist Canvas Utility Pouch",
      slug: "canvas-utility-pouch",
      sku: "PCH-CAN-003",
      category: "Accessories",
      description:
        "Heavyweight natural canvas pouch with antique brass YKK zipper and genuine leather pull tab. Ideal for cables, stationery, cosmetics, or everyday EDC essentials.",
      price: 650.0,
      image: "/images/canvas-pouch.svg",
      variants: [
        {
          id: "d0000002-0000-4000-8000-000000000004",
          title: "Natural Ecru / One Size",
          sku: "PCH-CAN-ECR",
          stock: 35,
          price: 650.0,
        },
      ],
      aiFacts: {
        sellingPoints: "Smooth brass zipper, wipeable interior lining, compact travel size.",
        audience: "Minimalists, travelers, everyday carry enthusiasts.",
        care: "Spot clean only.",
        policyExceptions: "Final sale unless manufacturing defect.",
      },
    },
    {
      id: "d0000001-0000-4000-8000-000000000004",
      name: "Botanical Cedar & Shea Hand Balm",
      slug: "botanical-hand-balm",
      sku: "BLM-BOT-004",
      category: "Personal Care",
      description:
        "Deeply hydrating botanical hand balm blended with raw African shea butter, cold-pressed sweet almond oil, and therapeutic cedarwood essential oil. Non-greasy finish.",
      price: 480.0,
      image: "/images/hand-balm.svg",
      variants: [
        {
          id: "d0000002-0000-4000-8000-000000000005",
          title: "Cedarwood & Bergamot / 60ml",
          sku: "BLM-BOT-60ML",
          stock: 3, // Low stock indicator
          price: 480.0,
        },
      ],
      aiFacts: {
        sellingPoints: "All-natural ingredients, zero synthetic fragrance, 100% recyclable aluminum tin.",
        audience: "Individuals experiencing dry hands or seeking natural grooming skincare.",
        care: "Store in a cool dry place away from direct heat.",
        policyExceptions: "Non-returnable once seal is broken.",
      },
    },
    {
      id: "d0000001-0000-4000-8000-000000000005",
      name: "Natural Woven Flax Linen Tote",
      slug: "natural-flax-tote",
      sku: "TOT-NAT-005",
      category: "Bags & Accessories",
      description:
        "Unbleached woven Belgian flax linen tote with unstructured silhouette and durable bound internal seams. Lightweight, packable, and naturally antimicrobial.",
      price: 1100.0,
      image: "/images/natural-tote.svg",
      variants: [
        {
          id: "d0000002-0000-4000-8000-000000000006",
          title: "Raw Natural Flax / One Size",
          sku: "TOT-NAT-OS",
          stock: 0, // Out of stock indicator
          price: 1100.0,
        },
      ],
      aiFacts: {
        sellingPoints: "100% organic flax linen, gets softer with each wash, featherlight folding.",
        audience: "Eco-conscious shoppers, linen lovers, minimalist travelers.",
        care: "Gentle machine wash cold. Line dry in shade.",
        policyExceptions: "Returnable within 7 days.",
      },
    },
    {
      id: "d0000001-0000-4000-8000-000000000006",
      name: "Daily Handcrafted Leather Sandals",
      slug: "daily-leather-sandals",
      sku: "SND-LTH-006",
      category: "Footwear",
      description:
        "Full-grain vegetable tanned leather slip-on sandals with cushioned ergonomic footbed and non-slip crepe rubber outsole. Hand-stitched in small batches.",
      price: 2600.0,
      image: "/images/daily-sandals.svg",
      variants: [
        {
          id: "d0000002-0000-4000-8000-000000000007",
          title: "Tan Leather / EU 40",
          sku: "SND-LTH-40",
          stock: 6,
          price: 2600.0,
        },
        {
          id: "d0000002-0000-4000-8000-000000000008",
          title: "Tan Leather / EU 42",
          sku: "SND-LTH-42",
          stock: 6,
          price: 2600.0,
        },
      ],
      aiFacts: {
        sellingPoints: "Vegetable tanned leather moulds to your foot over time, durable resoleable crepe base.",
        audience: "Lifestyle shoppers seeking enduring artisanal footwear.",
        care: "Treat with natural leather conditioner every 3 months. Avoid soaking in water.",
        policyExceptions: "Exchange for sizing supported within 7 days if soles are unmarked.",
      },
    },
  ];

  console.log(`Seeding ${demoProducts.length} demo products...`);

  // Clear existing demo products for this shop to ensure fresh idempotent seed
  const existingProducts = await db.collection("products").find({ shopId: DEMO_SHOP_ID }).toArray();
  const prodIds = existingProducts.map((p) => p._id);
  if (prodIds.length > 0) {
    await db.collection("products").deleteMany({ shopId: DEMO_SHOP_ID });
    await db.collection("productVariants").deleteMany({ shopId: DEMO_SHOP_ID });
    await db.collection("inventoryBalances").deleteMany({ shopId: DEMO_SHOP_ID });
    await db.collection("inventoryLedger").deleteMany({ shopId: DEMO_SHOP_ID });
  }

  for (const p of demoProducts) {
    const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
    await db.collection("products").insertOne({
      _id: p.id,
      shopId: DEMO_SHOP_ID,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      category: p.category,
      description: p.description,
      imageUrl: p.image,
      images: [p.image],
      stock: totalStock,
      status: "active",
      price: Decimal128.fromString(p.price.toFixed(2)),
      currency: "BDT",
      version: 1,
      aiFacts: p.aiFacts,
      seo: {
        title: `${p.name} — Easy Shop Studio`,
        description: p.description.slice(0, 150),
      },
      delivery: {
        weightGrams: 500,
        note: "Shipped in eco-friendly protective packaging.",
      },
      createdAt: now,
      updatedAt: now,
    });

    for (const v of p.variants) {
      await db.collection("productVariants").insertOne({
        _id: v.id,
        shopId: DEMO_SHOP_ID,
        productId: p.id,
        title: v.title,
        sku: v.sku,
        price: Decimal128.fromString(v.price.toFixed(2)),
        openingStock: v.stock,
        lowStockThreshold: 5,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      await db.collection("inventoryBalances").insertOne({
        _id: v.id,
        shopId: DEMO_SHOP_ID,
        productId: p.id,
        onHand: v.stock,
        reserved: 0,
        sold: 0,
        returned: 0,
        version: 1,
      });

      await db.collection("inventoryLedger").insertOne({
        _id: randomUUID(),
        shopId: DEMO_SHOP_ID,
        variantId: v.id,
        productId: p.id,
        deltaQuantity: v.stock,
        quantityAfter: v.stock,
        reason: "initial_demo_stock",
        createdBy: DEMO_USER_ID,
        createdAt: now,
      });
    }
  }

  // Seed sample customers
  console.log("Seeding sample customers...");
  const sampleCustomers = [
    {
      id: "d0000003-0000-4000-8000-000000000001",
      name: "Nadia Rahman",
      email: "nadia.rahman@example.com",
      phone: "+8801711000001",
      address: "House 14, Road 7, Dhanmondi, Dhaka",
      city: "Dhaka",
      notes: "Loyal customer. Prefers contactless courier delivery in the afternoon.",
      tags: ["VIP", "Repeat Buyer"],
    },
    {
      id: "d0000003-0000-4000-8000-000000000002",
      name: "Tanvir Ahmed",
      email: "tanvir.ahmed@example.com",
      phone: "+8801711000002",
      address: "Apt 4B, Gulshan Avenue 2, Dhaka",
      city: "Dhaka",
      notes: "First order placed yesterday. Interested in linen apparel.",
      tags: ["New Customer"],
    },
    {
      id: "d0000003-0000-4000-8000-000000000003",
      name: "Sadia Chowdhury",
      email: "sadia.c@example.com",
      phone: "+8801711000003",
      address: "House 28, Sector 4, Uttara, Dhaka",
      city: "Dhaka",
      notes: "Inquired on Instagram regarding custom bundle options.",
      tags: ["Inquiry", "Social"],
    },
  ];

  for (const c of sampleCustomers) {
    await db.collection("customers").updateOne(
      { _id: c.id },
      {
        $set: {
          shopId: DEMO_SHOP_ID,
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address,
          city: c.city,
          notes: c.notes,
          tags: c.tags,
          status: "active",
          source: "storefront",
          version: 1,
          lastActivityAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
          requestId: randomUUID(),
          fingerprint: randomBytes(16).toString("hex"),
        },
      },
      { upsert: true }
    );
  }

  // Seed sample conversation and AI Draft for Inbox
  console.log("Seeding sample AI Inbox conversation...");
  const convId = "d0000004-0000-4000-8000-000000000001";
  const customerId = sampleCustomers[0].id;

  await db.collection("conversations").updateOne(
    { _id: convId },
    {
      $set: {
        shopId: DEMO_SHOP_ID,
        customerId,
        channel: "storefront",
        status: "open",
        aiStatus: "draft_ready",
        unreadCount: 1,
        lastMessage: {
          text: "Hi! Is the Everyday Olive Canvas Tote in stock and available for delivery in Dhaka?",
          sender: "customer",
          createdAt: now,
        },
        lastActivityAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const msgId = "d0000005-0000-4000-8000-000000000001";
  await db.collection("messages").updateOne(
    { _id: msgId },
    {
      $set: {
        shopId: DEMO_SHOP_ID,
        conversationId: convId,
        sender: "customer",
        source: "storefront",
        text: "Hi! Is the Everyday Olive Canvas Tote in stock and available for delivery in Dhaka?",
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  );

  await db.collection("aiDrafts").updateOne(
    { conversationId: convId },
    {
      $set: {
        shopId: DEMO_SHOP_ID,
        conversationId: convId,
        suggestedText:
          "Hello Nadia! Yes, our Everyday Olive Canvas Tote is in stock (৳ 1,250). We deliver across Dhaka within 24–48 hours with Cash on Delivery available. Would you like me to reserve one for you?",
        status: "ready",
        confidence: 0.96,
        provider: "grounded-rules",
        updatedAt: now,
      },
      $setOnInsert: {
        _id: randomUUID(),
        createdAt: now,
      },
    },
    { upsert: true }
  );

  // Seed audit events for recent activity on dashboard
  console.log("Seeding audit events for dashboard timeline...");
  const auditEvents = [
    { action: "shop.launched", text: "Storefront published at /store/demo-store" },
    { action: "inventory.product_created", text: "Added 6 core products to catalog" },
    { action: "template.selected", text: "Storefront theme configured" },
    { action: "onboarding.started", text: "Shop created" },
  ];

  for (let i = 0; i < auditEvents.length; i++) {
    const ev = auditEvents[i];
    await db.collection("auditEvents").insertOne({
      _id: randomUUID(),
      shopId: DEMO_SHOP_ID,
      actorId: DEMO_USER_ID,
      actor: "owner",
      action: ev.action,
      targetType: "shop",
      targetId: DEMO_SHOP_ID,
      metadata: { text: ev.text },
      createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    });
  }

  console.log("\n==============================================");
  console.log(" DEMO ACCOUNT SEEDING COMPLETE!");
  console.log("==============================================");
  console.log("Email:       " + DEMO_EMAIL);
  console.log("Password:    " + DEMO_PASS);
  console.log("Shop Name:   Easy Shop Studio");
  console.log("Subdomain:   " + DEMO_SUBDOMAIN);
  console.log("Storefront:  http://localhost:3000/store/" + DEMO_SUBDOMAIN);
  console.log("Dashboard:   http://localhost:3000/dashboard");
  console.log("Products:    http://localhost:3000/products (6 products seeded)");
  console.log("Inbox:       http://localhost:3000/inbox (Sample inquiry with AI draft ready)");
  console.log("Customers:   http://localhost:3000/customers (3 customers seeded)");
  console.log("==============================================\n");

  await client.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
