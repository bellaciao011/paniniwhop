import type { IncomingMessage, ServerResponse } from "http";
import { markOrderPaid } from "../lib/orders";

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const event = await parseBody(req) as {
      action?: string;
      data?: { object?: { metadata?: { order_id?: string }; id?: string } };
    };

    console.log("[whop/webhook] action:", event.action);

    const action = event.action;
    if (
      action === "payment.completed" ||
      action === "membership.went_valid" ||
      action === "payment.succeeded"
    ) {
      const orderId = event.data?.object?.metadata?.order_id;
      if (orderId) {
        await markOrderPaid(orderId);
        console.log("[whop/webhook] marked PAID:", orderId);
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ received: true }));
  } catch (err) {
    console.error("[whop/webhook] error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Webhook error" }));
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
