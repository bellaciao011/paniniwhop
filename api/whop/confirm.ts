import type { IncomingMessage, ServerResponse } from "http";
import { markOrderPaid } from "../lib/orders";

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

  try {
    const body = await parseBody(req) as { orderId?: string; receiptId?: string };
    const { orderId } = body;

    if (!orderId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "orderId required" }));
      return;
    }

    const order = await markOrderPaid(orderId);

    if (!order) {
      // Order not found or already paid — return success anyway (idempotent)
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, trackingCode: null }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, trackingCode: order.tracking_code }));
  } catch (err) {
    console.error("[whop/confirm] error:", err);
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
