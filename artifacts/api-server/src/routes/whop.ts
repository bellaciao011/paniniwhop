import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { paniniOrdersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const WHOP_API = "https://api.whop.com/api/v1";

// Pre-created Whop plan IDs — product "Guía de automatizaciones con inteligencia artificial"
// Used when qty=1 and no bumps (avoids creating throwaway hidden plans for simple orders)
const PLAN_IDS: Record<string, string> = {
  // Kits
  basico:            "plan_uPuJDcfgEVo4z",
  iniciante:         "plan_5u7Xe2tsWs5dV",
  campeao:           "plan_ZhM8g4ytRmW5A",
  colecionador:      "plan_KFFCGe42V2ETs",
  dourada:           "plan_wX3VLFyupPk7Z",
  estadio:           "plan_1gLE5OOXhpbuq",
  // Packets
  box50:             "plan_d5MjYTUfGr4vE",
  bigbox:            "plan_0Me9rtPfmieAZ",
  pocketbundle:      "plan_N04s2kMAZ5L8i",
  tin2:              "plan_DTZluFzM5byMa",
  tin3:              "plan_ClVILgceCVb8V",
  tin4:              "plan_9U8fY7HnGVuK5",
  tinbundle:         "plan_Ngwrbu9GCpvkO",
  ultimatetinbundle: "plan_sm27JPyL4I1dc",
  // Order bumps
  bump50:            "plan_1EYBi8ASfgRmX",
  bump100:           "plan_mdl3UKRgYykUp",
  bump250:           "plan_ySu7OYSnNusVR",
};

function getWhopConfig() {
  const apiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID ?? "prod_rtCu83ZTNEb5P";
  if (!apiKey || !companyId) throw new Error("WHOP_API_KEY or WHOP_COMPANY_ID not configured");
  return { apiKey, companyId, productId };
}

function generateTrackingCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "PAN";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function whopPost(path: string, body: object, apiKey: string) {
  const res = await fetch(`${WHOP_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

router.post("/whop/checkout", async (req: Request, res: Response) => {
  try {
    const cfg = getWhopConfig();
    const {
      amount,
      customerEmail,
      customerName,
      customerPhone,
      customerDocument,
      shippingAddress,
      shippingPostalCode,
      shippingCity,
      shippingDistrict,
      kitId,
      productName,
      quantity,
      items,
      orderType = "main",
      utmParams = {},
      redirectBase,
    } = req.body as {
      amount: number;
      customerEmail: string;
      customerName: string;
      customerPhone?: string;
      customerDocument?: string;
      shippingAddress?: string;
      shippingPostalCode?: string;
      shippingCity?: string;
      shippingDistrict?: string;
      kitId?: string;
      productName?: string;
      quantity?: number;
      items?: unknown[];
      orderType?: string;
      utmParams?: Record<string, string>;
      redirectBase?: string;
    };

    if (!amount || !customerEmail || !customerName) {
      res.status(400).json({ error: "Campos obrigatórios: amount, customerEmail, customerName" });
      return;
    }

    const orderId = crypto.randomUUID();

    await db.insert(paniniOrdersTable).values({
      id: orderId,
      status: "PENDING",
      customerEmail,
      customerName,
      customerPhone,
      customerDocument,
      shippingAddress,
      shippingPostalCode,
      shippingCity,
      shippingDistrict,
      kitId,
      productName,
      quantity,
      amountEur: String(amount),
      items: items ?? null,
      orderType,
      utmSource: utmParams.utm_source,
      utmCampaign: utmParams.utm_campaign,
      utmMedium: utmParams.utm_medium,
      utmContent: utmParams.utm_content,
      utmTerm: utmParams.utm_term,
    });

    // Use pre-created plan when qty=1 and no bumps (total matches base kit price)
    // Otherwise create a dynamic hidden plan for the exact total
    const isSingleItem = (!quantity || quantity === 1) && kitId && PLAN_IDS[kitId];
    const hasOnlyKitItems = Array.isArray(items) && items.length === 1;
    const usePreCreated = isSingleItem && hasOnlyKitItems;

    let planId: string;

    if (usePreCreated) {
      planId = PLAN_IDS[kitId!]!;
      req.log.info({ orderId, planId, amount }, "Using pre-created Whop plan");
    } else {
      const plan = await whopPost("/plans", {
        company_id: cfg.companyId,
        product_id: cfg.productId,
        plan_type: "one_time",
        initial_price: amount,
        currency: "gbp",
        visibility: "hidden",
      }, cfg.apiKey) as { id?: string; error?: unknown };

      if (!plan.id) {
        req.log.error({ plan }, "Failed to create Whop plan");
        res.status(502).json({ error: "Erro ao criar plano de pagamento." });
        return;
      }

      planId = String(plan.id);
      req.log.info({ orderId, planId, amount }, "Created dynamic Whop plan");
    }

    const base = (redirectBase ?? "").replace(/\/$/, "");
    const redirectUrl = `${base}/checkout?return=1&orderId=${orderId}`;

    const checkout = await whopPost("/checkout_configurations", {
      plan_id: planId,
      redirect_url: redirectUrl,
      metadata: { order_id: orderId, kit_id: kitId ?? "", order_type: orderType },
    }, cfg.apiKey) as { purchase_url?: string; id?: string; error?: unknown };

    if (!checkout.purchase_url) {
      req.log.error({ checkout }, "Failed to create Whop checkout");
      res.status(502).json({ error: "Erro ao criar link de pagamento." });
      return;
    }

    await db.update(paniniOrdersTable)
      .set({ stripePaymentIntentId: planId })
      .where(eq(paniniOrdersTable.id, orderId));

    req.log.info({ orderId, planId, amount }, "Whop checkout created");
    res.json({
      purchaseUrl: checkout.purchase_url,
      orderId,
      planId,
      sessionId: checkout.id,
    });
  } catch (err) {
    req.log.error({ err }, "whop/checkout error");
    res.status(500).json({ error: "Erro interno ao criar pagamento." });
  }
});

// Called by the frontend onComplete callback after WhopCheckoutEmbed succeeds
router.post("/whop/confirm", async (req: Request, res: Response) => {
  try {
    const { orderId, receiptId } = req.body as { orderId?: string; receiptId?: string };
    if (!orderId) {
      res.status(400).json({ error: "orderId required" });
      return;
    }
    const trackingCode = generateTrackingCode();
    await db.update(paniniOrdersTable)
      .set({
        status: "PAID",
        paidAt: new Date(),
        trackingCode,
        updatedAt: new Date(),
        ...(receiptId ? { stripePaymentIntentId: receiptId } : {}),
      })
      .where(eq(paniniOrdersTable.id, orderId));
    req.log.info({ orderId, receiptId, trackingCode }, "Order confirmed via embed onComplete");
    res.json({ success: true, trackingCode });
  } catch (err) {
    req.log.error({ err }, "whop/confirm error");
    res.status(500).json({ error: "Erro ao confirmar pagamento." });
  }
});

router.post("/whop/webhook", async (req: Request, res: Response) => {
  try {
    const event = req.body as {
      action?: string;
      data?: {
        object?: {
          metadata?: { order_id?: string };
          plan?: { id?: string };
          id?: string;
        };
      };
    };

    req.log.info({ action: event.action }, "Whop webhook received");

    const action = event.action;

    if (action === "payment.completed" || action === "membership.went_valid" || action === "payment.succeeded") {
      const obj = event.data?.object;
      const orderId = obj?.metadata?.order_id;

      if (orderId) {
        const trackingCode = generateTrackingCode();
        await db.update(paniniOrdersTable)
          .set({ status: "PAID", paidAt: new Date(), trackingCode, updatedAt: new Date() })
          .where(eq(paniniOrdersTable.id, orderId));

        req.log.info({ orderId, trackingCode }, "Order marked PAID via Whop webhook");
      }
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err }, "whop-webhook error");
    res.status(500).json({ error: "Webhook error" });
  }
});

export default router;
