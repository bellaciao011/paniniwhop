import type { IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
import { createOrder, generateTrackingCode } from "../lib/orders";

const WHOP_API = "https://api.whop.com/api/v1";

const PLAN_IDS: Record<string, string> = {
  basico:            "plan_uPuJDcfgEVo4z",
  iniciante:         "plan_5u7Xe2tsWs5dV",
  campeao:           "plan_ZhM8g4ytRmW5A",
  colecionador:      "plan_KFFCGe42V2ETs",
  dourada:           "plan_wX3VLFyupPk7Z",
  estadio:           "plan_1gLE5OOXhpbuq",
  box50:             "plan_d5MjYTUfGr4vE",
  bigbox:            "plan_0Me9rtPfmieAZ",
  pocketbundle:      "plan_N04s2kMAZ5L8i",
  tin2:              "plan_DTZluFzM5byMa",
  tin3:              "plan_ClVILgceCVb8V",
  tin4:              "plan_9U8fY7HnGVuK5",
  tinbundle:         "plan_Ngwrbu9GCpvkO",
  ultimatetinbundle: "plan_sm27JPyL4I1dc",
  bump50:            "plan_1EYBi8ASfgRmX",
  bump100:           "plan_mdl3UKRgYykUp",
  bump250:           "plan_ySu7OYSnNusVR",
};

async function whopPost(path: string, body: object, apiKey: string) {
  const res = await fetch(`${WHOP_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const apiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_COMPANY_ID;
  const productId = process.env.WHOP_PRODUCT_ID ?? "prod_rtCu83ZTNEb5P";

  if (!apiKey || !companyId) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Whop not configured" }));
    return;
  }

  try {
    const body = await parseBody(req) as {
      amount?: number;
      customerEmail?: string;
      customerName?: string;
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

    const { amount, customerEmail, customerName } = body;
    if (!amount || !customerEmail || !customerName) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing required fields: amount, customerEmail, customerName" }));
      return;
    }

    const orderId = randomUUID();
    const trackingCode = generateTrackingCode();
    const kitId = body.kitId ?? "";
    const items = body.items ?? [];

    // Save order to DB as waiting_payment
    await createOrder({
      id: orderId,
      tracking_code: trackingCode,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: body.customerPhone ?? null,
      customer_document: body.customerDocument ?? null,
      shipping_address: body.shippingAddress ?? null,
      shipping_city: body.shippingCity ?? null,
      shipping_postal_code: body.shippingPostalCode ?? null,
      shipping_district: body.shippingDistrict ?? null,
      product_name: body.productName ?? "Kit Panini FIFA World Cup 2026",
      amount_eur: amount,
      utm_source: body.utmParams?.utm_source ?? null,
      utm_campaign: body.utmParams?.utm_campaign ?? null,
      utm_medium: body.utmParams?.utm_medium ?? null,
      utm_content: body.utmParams?.utm_content ?? null,
      utm_term: body.utmParams?.utm_term ?? null,
    }).catch(err => console.error("[DB] createOrder error:", err));

    // Pick pre-created plan (qty=1, no bumps) or create dynamic plan
    const isSingle = (!body.quantity || body.quantity === 1) && kitId && PLAN_IDS[kitId];
    const hasOnlyKit = Array.isArray(items) && items.length === 1;
    let planId: string;

    if (isSingle && hasOnlyKit) {
      planId = PLAN_IDS[kitId]!;
    } else {
      const plan = await whopPost("/plans", {
        company_id: companyId,
        product_id: productId,
        plan_type: "one_time",
        initial_price: amount,
        currency: "gbp",
        visibility: "hidden",
      }, apiKey) as { id?: string };

      if (!plan.id) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to create payment plan" }));
        return;
      }
      planId = String(plan.id);
    }

    const base = (body.redirectBase ?? "").replace(/\/$/, "");
    const redirectUrl = `${base}/checkout?return=1&orderId=${orderId}`;

    const checkout = await whopPost("/checkout_configurations", {
      plan_id: planId,
      redirect_url: redirectUrl,
      metadata: { order_id: orderId, kit_id: kitId, order_type: body.orderType ?? "main" },
      payment_method_types: ["card", "apple_pay", "google_pay"],
    }, apiKey) as { purchase_url?: string; id?: string };

    if (!checkout.purchase_url) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to create checkout link" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      purchaseUrl: checkout.purchase_url,
      orderId,
      planId,
      sessionId: checkout.id,
    }));
  } catch (err) {
    console.error("[whop/checkout] error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}

function parseBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => { try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
