import { useState, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  ChevronRight, CheckCircle2, ShieldCheck, Truck, Lock,
  CreditCard, CheckCircle, Loader2, AlertCircle,
} from "lucide-react";
import { WhopCheckoutEmbed, useCheckoutEmbedControls } from "@whop/checkout/react";
import { Header } from "@/components/Header";
import { kits } from "@/lib/kits";
import { stickerPackets } from "@/lib/packets";
import { readUtms } from "@/lib/utm";
import { apiUrl } from "@/lib/api";

export default function Checkout() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const kitId = params.get("kit") || "campeao";
  const allProducts = [...kits, ...stickerPackets];
  const kit = allProducts.find((k) => k.id === kitId) || kits[2];
  const utmParams = readUtms();

  const checkoutRef = useCheckoutEmbedControls();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string>("");
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);

  const [embedPlanId, setEmbedPlanId] = useState<string | null>(null);
  const [embedSessionId, setEmbedSessionId] = useState<string | null>(null);
  const [embedOrderId, setEmbedOrderId] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [preparingEmbed, setPreparingEmbed] = useState(false);

  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fmtGBP = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const orderBumps = [
    { id: "bump50", label: "+50 packs · ~350 stickers", desc: "Pre-sale discount with free delivery.", price: 39.99, oldPrice: 62.50, img: "/assets/bump-sobres.png", badge: null },
    { id: "bump100", label: "+100 packs · ~700 stickers", desc: "The collector's favourite — exclusive pre-sale.", price: 69.99, oldPrice: 125.00, img: "/assets/bump-sobres.png", badge: { text: "BEST SELLER", cls: "bg-red-600 text-white" } },
    { id: "bump250", label: "+250 packs · ~1,750 stickers", desc: "Maximum discount on this promotional bundle.", price: 149.99, oldPrice: 312.50, img: "/assets/bump-sobres.png", badge: { text: "LAST UNITS", cls: "bg-amber-400 text-gray-900" } },
  ];

  const bumpsTotal = orderBumps.filter(b => selectedBumps.has(b.id)).reduce((s, b) => s + b.price, 0);
  const orderTotal = kit.price * quantity + bumpsTotal;

  const toggleBump = (id: string) => {
    setSelectedBumps(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const [formData, setFormData] = useState({
    email: "", nome: "", telemovel: "", nif: "",
    codigoPostal: "", morada: "", numero: "", andar: "", localidade: "", distrito: "",
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (step < 3) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep === 3) {
        (window as any).fbq?.("track", "InitiateCheckout", {
          value: orderTotal, currency: "GBP",
          content_ids: [kit.id], content_type: "product",
          num_items: quantity + selectedBumps.size,
        });
      }
    }
  };

  const handlePrepareEmbed = async () => {
    setPreparingEmbed(true);
    setError("");
    try {
      const line2Parts = [
        formData.numero ? `#${formData.numero}` : null,
        formData.andar || null,
      ].filter(Boolean).join(", ");

      const items = [
        { id: kit.id, name: kit.name, quantity, price: kit.price },
        ...orderBumps.filter(b => selectedBumps.has(b.id)).map(b => ({
          id: b.id, name: b.label, quantity: 1, price: b.price,
        })),
      ];

      const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
      const redirectBase = window.location.origin + base;

      const res = await fetch(apiUrl("/api/whop/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: orderTotal,
          customerEmail: formData.email,
          customerName: formData.nome,
          customerPhone: formData.telemovel,
          customerDocument: formData.nif,
          shippingAddress: [formData.morada, line2Parts].filter(Boolean).join(", "),
          shippingPostalCode: formData.codigoPostal,
          shippingCity: formData.localidade,
          shippingDistrict: formData.distrito,
          kitId: kit.id,
          productName: "Kit Panini FIFA World Cup 2026",
          quantity,
          items,
          orderType: "main",
          utmParams,
          redirectBase,
        }),
      });

      const data = await res.json() as {
        planId?: string; sessionId?: string; orderId?: string; purchaseUrl?: string; error?: string;
      };

      if (!res.ok || !data.planId) {
        setError(data.error ?? "Error creating payment session. Please try again.");
        setPreparingEmbed(false);
        return;
      }

      setEmbedPlanId(data.planId);
      setEmbedSessionId(data.sessionId ?? null);
      setEmbedOrderId(data.orderId ?? null);
      setShowEmbed(true);
      setPreparingEmbed(false);
    } catch {
      setError("Could not connect to the payment server. Please check your connection.");
      setPreparingEmbed(false);
    }
  };

  const resetEmbed = () => {
    setShowEmbed(false);
    setEmbedPlanId(null);
    setEmbedSessionId(null);
    setEmbedOrderId(null);
  };

  const handleEmbedComplete = async (_id: string, receiptId?: string) => {
    try {
      const r = await fetch(apiUrl("/api/whop/confirm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: embedOrderId, receiptId }),
      });
      const d = await r.json() as { trackingCode?: string };
      if (d.trackingCode) setTrackingCode(d.trackingCode);
    } catch { /* confirm failed silently */ }
    setShowEmbed(false);
    setStep(4);
  };

  // Auto-load Whop checkout when entering step 3
  useEffect(() => {
    if (step === 3) handlePrepareEmbed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Reload checkout when bumps or quantity change on step 3
  useEffect(() => {
    if (step !== 3) return;
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      resetEmbed();
      handlePrepareEmbed();
    }, 400);
    return () => { if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBumps, quantity]);

  // Step 4: Confirmation
  if (step === 4) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center">
        <Header />
        <main className="w-full max-w-md mx-auto p-4 py-12 flex-1 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5 bg-green-100"
          >
            <CheckCircle className="w-10 h-10 text-green-600" />
          </motion.div>
          <h1 className="text-2xl font-black text-green-700 mb-2">Order confirmed!</h1>
          <p className="text-gray-600 text-sm mb-6 max-w-xs leading-relaxed">
            Your order was received. You'll get a confirmation email shortly.
          </p>
          {trackingCode && (
            <div className="w-full bg-[#7B1C1C]/5 border border-[#7B1C1C]/20 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs font-bold text-[#7B1C1C]/60 uppercase tracking-widest mb-1">Your tracking code</p>
              <p className="text-2xl font-black text-[#7B1C1C] font-mono tracking-widest mb-3">{trackingCode}</p>
              <a href={`/rastreio?codigo=${trackingCode}`}
                className="inline-block bg-[#7B1C1C] text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-[#5a0c16] transition-colors">
                Track my order →
              </a>
            </div>
          )}
          <div className="w-full bg-white border border-gray-100 rounded-xl p-4 text-left shadow-sm">
            <h3 className="font-bold text-gray-900 text-sm mb-3 border-b pb-2">Order Summary</h3>
            <div className="flex justify-between mb-1.5 text-sm">
              <span className="text-gray-500">Product</span>
              <span className="font-medium text-gray-900">{kit.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-medium text-gray-900">{fmtGBP(orderTotal)}</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pb-12">
      <Header />
      <main className="w-full max-w-5xl mx-auto px-4 pt-6 pb-4">

        {/* Progress */}
        <div className="flex items-center justify-between px-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${step >= i ? "bg-primary text-white" : "bg-gray-200 text-gray-400"}`}>
                {step > i ? <CheckCircle2 className="w-5 h-5" /> : i}
              </div>
              <span className={`ml-2 text-xs md:text-sm font-semibold ${step >= i ? "text-gray-900" : "text-gray-400"}`}>
                {i === 1 ? "Order" : i === 2 ? "Delivery" : "Payment"}
              </span>
              {i < 3 && <div className={`w-8 md:w-16 h-1 mx-2 rounded ${step > i ? "bg-primary" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Sidebar */}
          <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
              <div className="relative overflow-hidden bg-gray-50 border-b border-gray-100">
                <img src={kit.img} alt={kit.name} className="w-full h-28 lg:h-36 object-contain py-2 px-8" />
                <div className="absolute top-[28px] right-[-36px] w-[148px] text-center py-[5px] rotate-45 shadow-lg"
                  style={{ background: "linear-gradient(135deg, #f5a623 0%, #fbbf24 40%, #f5a623 100%)" }}>
                  <span className="text-[10px] font-black tracking-[0.18em] uppercase text-[#7c4a00]">Promotion</span>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-bold text-gray-900 text-sm">{kit.name}</p>
                  <span className="text-xs font-black text-primary">{fmtGBP(kit.price)}</span>
                </div>
                <p className="text-xs text-gray-400 mb-1">{kit.contents}</p>
                <div className="flex items-center gap-1 text-yellow-500 text-xs mb-3">
                  ★★★★★ <span className="text-gray-400">4.9 · +2,200 ratings</span>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-gray-200">
                  <span className="text-xs font-semibold text-gray-700">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 font-black hover:border-primary hover:text-primary transition-all text-sm">−</button>
                    <span className="w-6 text-center font-black text-gray-900 text-sm">{quantity}</span>
                    <button type="button" onClick={() => setQuantity(q => Math.min(10, q + 1))}
                      className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-600 font-black hover:border-primary hover:text-primary transition-all text-sm">+</button>
                  </div>
                </div>
                <div className="space-y-1 border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Regular price</span>
                    <span className="line-through">{fmtGBP(kit.oldPrice * quantity)}</span>
                  </div>
                  {quantity > 1 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{kit.name} × {quantity}</span>
                      <span>{fmtGBP(kit.price * quantity)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Delivery</span>
                    <span className="text-green-600 font-semibold">Free</span>
                  </div>
                  {orderBumps.filter(b => selectedBumps.has(b.id)).map(b => (
                    <div key={b.id} className="flex justify-between text-xs text-gray-500">
                      <span className="truncate pr-2">{b.label}</span>
                      <span className="flex-shrink-0">+{fmtGBP(b.price)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="font-bold text-gray-900 text-xs">Total</span>
                    <span className="text-base font-black text-primary">{fmtGBP(orderTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main form */}
          <div className="lg:col-span-7 lg:col-start-1 lg:row-start-1 flex flex-col gap-6">
            <form onSubmit={handleNext} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

              {/* Step 1 */}
              {step === 1 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">1. Your details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email address *</label>
                      <input required type="email" name="email" value={formData.email} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                        placeholder="name@gmail.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
                      <input required type="text" name="nome" value={formData.nome} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                        placeholder="First and last name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile number *</label>
                      <input required type="tel" name="telemovel" value={formData.telemovel} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                        placeholder="07700 900123" />
                      <p className="text-xs text-gray-500 mt-1">For SMS delivery notifications.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tax reference (optional)</label>
                      <input type="text" name="nif" value={formData.nif} onChange={handleChange}
                        maxLength={13} minLength={9}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                        placeholder="UTR / Company number" />
                    </div>
                  </div>
                  <button type="submit"
                    className="mt-8 w-full bg-primary hover:bg-green-700 text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    Continue <ChevronRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-6">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-bold text-gray-900">Delivery address</h2>
                    <button type="button" onClick={() => setStep(1)} className="text-sm text-primary font-medium hover:underline">Edit details</button>
                  </div>
                  <p className="text-sm text-gray-400 mb-6 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-green-500" /> Free delivery across the UK
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1.5">Postcode <span className="text-red-500">*</span></label>
                      <input required type="text" name="codigoPostal" value={formData.codigoPostal} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white"
                        placeholder="e.g. SW1A 1AA" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1.5">Street address <span className="text-red-500">*</span></label>
                      <input required type="text" name="morada" value={formData.morada} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white"
                        placeholder="e.g. 10 Downing Street" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">Number</label>
                        <input type="text" name="numero" value={formData.numero} onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white"
                          placeholder="e.g. 10" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">Flat / Floor</label>
                        <input type="text" name="andar" value={formData.andar} onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white"
                          placeholder="e.g. Flat 2" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1.5">City <span className="text-red-500">*</span></label>
                      <input required type="text" name="localidade" value={formData.localidade} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white"
                        placeholder="e.g. London" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1.5">County / Region</label>
                      <select name="distrito" value={formData.distrito} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50 focus:bg-white text-gray-700">
                        <option value="">Select county (optional)</option>
                        {["Greater London","West Midlands","Greater Manchester","West Yorkshire","Merseyside","South Yorkshire","Tyne and Wear","Hampshire","Nottinghamshire","Derbyshire","Staffordshire","Lancashire","Essex","Kent","Surrey","Hertfordshire","Berkshire","Buckinghamshire","Oxfordshire","Cambridgeshire","Norfolk","Suffolk","Devon","Somerset","Dorset","Wiltshire","Gloucestershire","Warwickshire","Northamptonshire","Lincolnshire","Cheshire","Cumbria","North Yorkshire","Durham","Other"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit"
                    className="mt-8 w-full bg-primary hover:bg-green-700 text-white font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    Continue to payment <ChevronRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}

              {/* Step 3 — Payment */}
              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>

                  {/* Bumps — always visible so user can add/remove before paying */}
                  <div className="bg-green-50 border-b border-green-100 px-5 py-3">
                    <p className="text-sm font-black text-primary text-center">Add more packs at a promotional price</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {orderBumps.map(bump => {
                      const active = selectedBumps.has(bump.id);
                      return (
                        <div key={bump.id} className={`p-4 transition-colors ${active ? "bg-green-50" : "bg-white"}`}>
                          <div className="flex gap-3 mb-3">
                            <img src={bump.img} alt={bump.label} className="w-16 h-16 object-contain rounded-lg border border-gray-100 bg-white flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                <span className="font-bold text-gray-900 text-sm">{bump.label}</span>
                                {bump.badge && (
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${bump.badge.cls}`}>{bump.badge.text}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mb-1.5">{bump.desc}</p>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xs text-gray-400 line-through">{fmtGBP(bump.oldPrice)}</span>
                                <span className="text-lg font-black text-primary">{fmtGBP(bump.price)}</span>
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={() => toggleBump(bump.id)}
                            className={`w-full py-2.5 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                              active ? "border-primary bg-primary text-white" : "border-primary text-primary bg-white hover:bg-green-50"
                            }`}>
                            {active ? <><CheckCircle className="w-4 h-4" /> Added</> : <>+ Add to order</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Payment area */}
                  <div className="border-t border-gray-100">
                    {error && (
                      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 m-4">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    )}

                    {/* Loading indicator while preparing checkout */}
                    {preparingEmbed && (
                      <div className="flex flex-col items-center py-10 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-gray-500 font-medium">Loading secure checkout…</p>
                      </div>
                    )}

                    {/* ── PAYMENT EMBED ── */}
                    {showEmbed && (embedSessionId || embedPlanId) && (
                      <div>
                        <div className="flex items-center justify-between px-5 pt-5 pb-2">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-bold text-gray-700">
                              Secure payment · {fmtGBP(orderTotal)}
                            </span>
                          </div>
                          <button type="button" onClick={() => setStep(2)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                            ← Back
                          </button>
                        </div>

                        <WhopCheckoutEmbed
                          {...(embedSessionId
                            ? { sessionId: embedSessionId }
                            : { planId: embedPlanId! }
                          )}
                          ref={checkoutRef}
                          theme="light"
                          hideEmail={true}
                          hideAddressForm={true}
                          skipRedirect={true}
                          prefill={{
                            email: formData.email,
                            address: {
                              name: formData.nome,
                              country: "GB",
                              line1: formData.morada,
                              ...(formData.numero || formData.andar ? {
                                line2: [formData.numero && `#${formData.numero}`, formData.andar].filter(Boolean).join(", "),
                              } : {}),
                              city: formData.localidade,
                              state: formData.distrito || "",
                              postalCode: formData.codigoPostal,
                            },
                          }}
                          styles={{ container: { paddingX: 0, paddingY: 8 } }}
                          onComplete={handleEmbedComplete}
                        />
                      </div>
                    )}

                    {!showEmbed && !preparingEmbed && !error && (
                      <div className="px-5 pb-5 pt-4">
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-black text-gray-500 border border-gray-300 rounded px-2 py-0.5">VISA</span>
                          <span className="text-xs font-black text-gray-500 border border-gray-300 rounded px-2 py-0.5">MASTERCARD</span>
                        </div>
                        <p className="text-center text-[10px] text-gray-400">Panini UK Ltd · Printed in England<br />Company No. 00000000</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </form>

            {step < 3 && (
              <div className="flex justify-center gap-6">
                {[
                  { icon: Lock, label: "Secure payment" },
                  { icon: ShieldCheck, label: "Protected purchase" },
                  { icon: Truck, label: "Free delivery" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1 text-gray-500">
                    <Icon className="w-5 h-5 text-gray-400" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
