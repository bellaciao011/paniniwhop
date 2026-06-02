---
name: Whop Integration
description: Como o Whop foi integrado neste projeto — fluxo, IDs e decisões de implementação.
---

## Decisões

- Whop **não tem conector automático Replit** — usar API REST diretamente com `WHOP_API_KEY` e `WHOP_COMPANY_ID`.
- O conector Replit Whop (`whop-mcp.mjs` / `whop-api.mjs`) requer binding via connectors.replit.com que não está disponível — usar `fetch` direto para `api.whop.com/api/v1`.
- Checkout usa **planos dinâmicos**: cria um plano `hidden` com o valor exato do pedido a cada checkout, depois cria um `checkout_configuration` com esse plano. Isso suporta quantidade variável + order bumps.
- O `checkout_configuration` NÃO aceita `initial_price` override — o preço tem que vir do plano.
- `external_identifier` não é suportado em planos — não usar.

**Why:** Os produtos têm preço fixo por SKU, mas o total do pedido varia (quantidade + bumps), tornando inviável pré-criar planos para cada combinação possível.

## IDs Importantes

- Product: `prod_rtCu83ZTNEb5P` (salvo em `WHOP_PRODUCT_ID`)
- Company: `biz_I0xDkQrCJYyl75` (salvo em `WHOP_COMPANY_ID`)

## Fluxo

1. Frontend coleta dados (Step 1 + 2) → Step 3 mostra botão "Pay"
2. Click → POST `/api/whop/checkout` → backend cria plano hidden + checkout_configuration
3. Backend retorna `{ purchaseUrl, orderId }`
4. Frontend redireciona para `purchaseUrl` (página Whop hospedada)
5. Após pagamento Whop redireciona para `/checkout?return=1&orderId=...`
6. Frontend detecta `return=1` → exibe Step 4 (confirmação + polling)
7. Webhook `/api/whop/webhook` marca pedido como PAID no DB

## Arquivos

- Backend: `artifacts/api-server/src/routes/whop.ts`
- Frontend: `artifacts/panini-mundial/src/pages/checkout.tsx` (Stripe removido)
- Upsell pages: **deletadas** (upsell.tsx, upsell2.tsx)
