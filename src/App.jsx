import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  X,
  Check,
  Receipt as ReceiptIcon,
  Clock,
  History,
  Loader2,
} from "lucide-react";
import { supabase } from "./supabaseClient";

const CATEGORIES = ["Semua", "Cetak Body", "Tangki & Wadah", "Reparasi", "Custom & Molding"];

const PRODUCTS = [
  { id: 1, name: "Cetak Body Motor (per set)", price: 350000, cat: "Cetak Body", emoji: "🏍️", durasi: "3 hari" },
  { id: 2, name: "Cetak Kap Mesin Mobil", price: 450000, cat: "Cetak Body", emoji: "🚗", durasi: "4 hari" },
  { id: 3, name: "Cetak Fender/Spakbor Custom", price: 200000, cat: "Cetak Body", emoji: "🔧", durasi: "2 hari" },
  { id: 4, name: "Cetak Helm Custom", price: 250000, cat: "Cetak Body", emoji: "⛑️", durasi: "3 hari" },
  { id: 5, name: "Tangki Air Fiberglass Custom", price: 1200000, cat: "Tangki & Wadah", emoji: "🛢️", durasi: "5 hari" },
  { id: 6, name: "Bak Kontrol/Wadah Kimia", price: 850000, cat: "Tangki & Wadah", emoji: "🧴", durasi: "4 hari" },
  { id: 7, name: "Talang Air Fiberglass (per meter)", price: 150000, cat: "Tangki & Wadah", emoji: "🌧️", durasi: "2 hari" },
  { id: 8, name: "Perahu/Kano Custom", price: 3500000, cat: "Tangki & Wadah", emoji: "🛶", durasi: "10 hari" },
  { id: 9, name: "Reparasi Body Motor Pecah", price: 75000, cat: "Reparasi", emoji: "🛠️", durasi: "1 hari" },
  { id: 10, name: "Reparasi Bodi Mobil Retak", price: 150000, cat: "Reparasi", emoji: "🚙", durasi: "1 hari" },
  { id: 11, name: "Reparasi Tangki Fiberglass Bocor", price: 120000, cat: "Reparasi", emoji: "🩹", durasi: "1 hari" },
  { id: 12, name: "Poles & Finishing Gelcoat", price: 100000, cat: "Reparasi", emoji: "✨", durasi: "1 hari" },
  { id: 13, name: "Pembuatan Cetakan (Molding) Custom", price: 500000, cat: "Custom & Molding", emoji: "🗜️", durasi: "5 hari" },
  { id: 14, name: "Laminasi Fiberglass (per m²)", price: 85000, cat: "Custom & Molding", emoji: "📐", durasi: "2 hari" },
  { id: 15, name: "Custom Part Sesuai Desain", price: 400000, cat: "Custom & Molding", emoji: "🎨", durasi: "6 hari" },
];

function rupiah(n) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export default function App() {
  const [activeCat, setActiveCat] = useState("Semua");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [payMethod, setPayMethod] = useState("tunai");
  const [cashInput, setCashInput] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [txCounter, setTxCounter] = useState(1);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const receiptRef = useRef(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("transaksi")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      setHistory(data);
      const maxNo = data.reduce((m, h) => Math.max(m, h.no_struk || 0), 0);
      setTxCounter(maxNo + 1);
    } else if (error) {
      setErrorMsg("Gagal memuat riwayat: " + error.message);
    }
    setLoadingHistory(false);
  }

  const filtered = useMemo(() => {
    return PRODUCTS.filter(
      (p) =>
        (activeCat === "Semua" || p.cat === activeCat) &&
        p.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [activeCat, query]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = (subtotal * discountPct) / 100;
  const total = subtotal - discountAmt;
  const cash = parseFloat(cashInput.replace(/[^0-9]/g, "")) || 0;
  const change = cash - total;

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, emoji: product.emoji }];
    });
  }

  function changeQty(id, delta) {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0)
    );
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function resetTransaction() {
    setCart([]);
    setDiscountPct(0);
    setCashInput("");
    setPayMethod("tunai");
    setShowPay(false);
  }

  async function confirmPayment() {
    if (payMethod === "tunai" && cash < total) return;
    setSaving(true);
    setErrorMsg("");
    const row = {
      no_struk: txCounter,
      items: cart,
      subtotal,
      discount_pct: discountPct,
      discount_amt: discountAmt,
      total,
      metode_bayar: payMethod,
      cash: payMethod === "tunai" ? cash : total,
      kembalian: payMethod === "tunai" ? change : 0,
    };
    const { data, error } = await supabase.from("transaksi").insert(row).select().single();
    setSaving(false);
    if (error) {
      setErrorMsg("Gagal menyimpan transaksi: " + error.message);
      return;
    }
    setHistory((prev) => [data, ...prev]);
    setLastTx(data);
    setTxCounter((n) => n + 1);
    setShowPay(false);
    setShowReceipt(true);
  }

  function finishReceipt() {
    setShowReceipt(false);
    resetTransaction();
  }

  return (
    <div className="min-h-screen w-full bg-[#F1EEE6] text-[#231F1A]">
      <header className="flex items-center justify-between px-6 py-4 bg-[#1F3D34] text-[#F1EEE6] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[#E8A33D] flex items-center justify-center text-[#1F3D34] font-bold font-display">
            CPF
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight font-display">Cahaya Putra Fiberglass</h1>
            <p className="text-xs text-[#C9C2AE]">Kasir · Jasa Custom & Cetak Fiberglass</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md"
          >
            <History size={14} /> Riwayat
          </button>
          <div className="text-right text-xs text-[#C9C2AE]">
            <div>
              {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>
            <div>{new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>
      </header>

      {errorMsg && (
        <div className="bg-[#FBEAE8] text-[#C1443A] text-sm px-6 py-2">{errorMsg}</div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 p-4 lg:p-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8680]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari jasa..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white border border-[#DDD6C4] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3D34] placeholder:text-[#B3AC98]"
              />
            </div>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCat === c
                    ? "bg-[#1F3D34] text-white"
                    : "bg-white text-[#5B5648] border border-[#DDD6C4] hover:border-[#1F3D34]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="text-left bg-white rounded-xl border border-[#E4DECD] p-3 hover:border-[#1F3D34] hover:shadow-md transition-all active:scale-[0.97]"
              >
                <div className="text-3xl mb-2">{p.emoji}</div>
                <div className="text-sm font-medium leading-snug mb-1">{p.name}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold text-[#1F3D34] font-mono">{rupiah(p.price)}</span>
                  <span className="text-[10px] text-[#B3AC98] flex items-center gap-1">
                    <Clock size={10} /> {p.durasi}
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-[#8B8680] text-sm">Jasa tidak ditemukan.</div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[380px] shrink-0">
          <div className="bg-white rounded-t-xl border border-[#E4DECD] overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-dashed border-[#D8D0BA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ReceiptIcon size={16} className="text-[#1F3D34]" />
                <span className="font-semibold text-sm font-display">
                  Struk #{String(txCounter).padStart(4, "0")}
                </span>
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-[#C1443A] hover:underline">
                  Kosongkan
                </button>
              )}
            </div>

            <div className="max-h-[38vh] overflow-y-auto px-4 py-2 divide-y divide-[#F0EBDD]">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-[#B3AC98] text-sm">
                  Belum ada jasa dipilih.
                  <br />
                  Ketuk jasa untuk menambah.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center gap-2">
                    <span className="text-lg">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-[#8B8680] font-mono">
                        {rupiah(item.price)} × {item.qty}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => changeQty(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-[#F1EEE6] hover:bg-[#E4DECD] flex items-center justify-center"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{item.qty}</span>
                      <button
                        onClick={() => changeQty(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-[#F1EEE6] hover:bg-[#E4DECD] flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-6 h-6 rounded-md hover:bg-[#FBEAE8] text-[#C1443A] flex items-center justify-center ml-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-3 border-t border-dashed border-[#D8D0BA] space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#5B5648]">Subtotal</span>
                <span className="font-mono">{rupiah(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#5B5648]">Diskon</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-12 text-right border border-[#DDD6C4] rounded px-1 py-0.5 text-xs"
                  />
                  <span className="text-xs text-[#8B8680]">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-base font-bold pt-1 font-display">
                <span>Total</span>
                <span className="text-[#1F3D34] font-mono">{rupiah(total)}</span>
              </div>
            </div>
          </div>

          <div
            className="h-4 bg-white"
            style={{
              clipPath:
                "polygon(0% 0%,5% 100%,10% 0%,15% 100%,20% 0%,25% 100%,30% 0%,35% 100%,40% 0%,45% 100%,50% 0%,55% 100%,60% 0%,65% 100%,70% 0%,75% 100%,80% 0%,85% 100%,90% 0%,95% 100%,100% 0%)",
            }}
          />

          <button
            disabled={cart.length === 0}
            onClick={() => setShowPay(true)}
            className="w-full mt-3 py-3 rounded-lg bg-[#E8A33D] text-[#231F1A] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition-all shadow-sm font-display"
          >
            Bayar {cart.length > 0 ? rupiah(total) : ""}
          </button>
        </div>
      </div>

      {showPay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg font-display">Pembayaran</h2>
              <button onClick={() => setShowPay(false)}>
                <X size={18} className="text-[#8B8680]" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-normal text-[#5B5648]">Total Tagihan</span>
              <span className="text-[#1F3D34] text-2xl font-bold font-mono">{rupiah(total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setPayMethod("tunai")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium ${
                  payMethod === "tunai" ? "border-[#1F3D34] bg-[#EAF1EE] text-[#1F3D34]" : "border-[#DDD6C4] text-[#5B5648]"
                }`}
              >
                <Banknote size={16} /> Tunai
              </button>
              <button
                onClick={() => setPayMethod("qris")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium ${
                  payMethod === "qris" ? "border-[#1F3D34] bg-[#EAF1EE] text-[#1F3D34]" : "border-[#DDD6C4] text-[#5B5648]"
                }`}
              >
                <QrCode size={16} /> QRIS
              </button>
            </div>

            {payMethod === "tunai" ? (
              <>
                <label className="text-xs text-[#8B8680] mb-1 block">Uang diterima</label>
                <input
                  autoFocus
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full border border-[#DDD6C4] rounded-lg px-3 py-2.5 text-lg font-semibold mb-2 font-mono"
                />
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {[total, 50000, 100000, 500000, 1000000]
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .map((v) => (
                      <button
                        key={v}
                        onClick={() => setCashInput(String(Math.round(v)))}
                        className="px-2.5 py-1 rounded-md bg-[#F1EEE6] text-xs font-medium hover:bg-[#E4DECD]"
                      >
                        {rupiah(v)}
                      </button>
                    ))}
                </div>
                <div className="flex items-center justify-between text-sm mb-4 px-1">
                  <span className="text-[#5B5648]">Kembalian</span>
                  <span className={`font-bold font-mono ${change < 0 ? "text-[#C1443A]" : "text-[#1F3D34]"}`}>
                    {change < 0 ? "Kurang " + rupiah(-change) : rupiah(change)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-4 mb-3 bg-[#F7F5EE] rounded-lg">
                <div className="w-32 h-32 bg-white border border-[#DDD6C4] rounded-lg flex items-center justify-center mb-2">
                  <QrCode size={64} className="text-[#231F1A]" />
                </div>
                <p className="text-xs text-[#8B8680]">Pindai untuk membayar {rupiah(total)}</p>
              </div>
            )}

            <button
              onClick={confirmPayment}
              disabled={saving || (payMethod === "tunai" && cash < total)}
              className="w-full py-3 rounded-lg bg-[#1F3D34] text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-display"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? "Menyimpan..." : "Konfirmasi Pembayaran"}
            </button>
          </div>
        </div>
      )}

      {showReceipt && lastTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-xs overflow-hidden">
            <div ref={receiptRef} className="p-5 font-mono">
              <div className="text-center mb-3">
                <div className="font-bold text-sm font-display">CAHAYA PUTRA FIBERGLASS</div>
                <div className="text-[10px] text-[#8B8680]">Jasa Custom & Cetak Fiberglass</div>
                <div className="text-[10px] text-[#8B8680]">
                  {new Date(lastTx.created_at || Date.now()).toLocaleString("id-ID")}
                </div>
              </div>
              <div className="border-t border-dashed border-[#D8D0BA] my-2" />
              {lastTx.items.map((i) => (
                <div key={i.id} className="text-xs mb-1">
                  <div className="flex justify-between">
                    <span className="truncate pr-2">{i.name}</span>
                  </div>
                  <div className="flex justify-between text-[#8B8680]">
                    <span>
                      {i.qty} x {rupiah(i.price)}
                    </span>
                    <span>{rupiah(i.qty * i.price)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-dashed border-[#D8D0BA] my-2" />
              <div className="flex justify-between text-xs">
                <span>Subtotal</span>
                <span>{rupiah(lastTx.subtotal)}</span>
              </div>
              {lastTx.discount_pct > 0 && (
                <div className="flex justify-between text-xs">
                  <span>Diskon ({lastTx.discount_pct}%)</span>
                  <span>-{rupiah(lastTx.discount_amt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold mt-1">
                <span>TOTAL</span>
                <span>{rupiah(lastTx.total)}</span>
              </div>
              <div className="border-t border-dashed border-[#D8D0BA] my-2" />
              <div className="flex justify-between text-xs">
                <span>{lastTx.metode_bayar === "tunai" ? "Tunai" : "QRIS"}</span>
                <span>{rupiah(lastTx.cash)}</span>
              </div>
              {lastTx.metode_bayar === "tunai" && (
                <div className="flex justify-between text-xs">
                  <span>Kembali</span>
                  <span>{rupiah(lastTx.kembalian)}</span>
                </div>
              )}
              <div className="text-center text-[10px] text-[#8B8680] mt-4">Terima kasih atas kepercayaannya!</div>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={finishReceipt}
                className="w-full py-2.5 rounded-lg bg-[#1F3D34] text-white font-bold text-sm font-display"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg font-display">Riwayat Transaksi</h2>
              <button onClick={() => setShowHistory(false)}>
                <X size={18} className="text-[#8B8680]" />
              </button>
            </div>

            {(() => {
              const todayStr = new Date().toDateString();
              const todayTx = history.filter((h) => new Date(h.created_at).toDateString() === todayStr);
              const omzetHariIni = todayTx.reduce((s, h) => s + Number(h.total), 0);
              return (
                <div className="bg-[#F1EEE6] rounded-lg px-4 py-3 mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[#8B8680]">Omzet Hari Ini</div>
                    <div className="text-lg font-bold text-[#1F3D34] font-mono">{rupiah(omzetHariIni)}</div>
                  </div>
                  <div className="text-xs text-[#8B8680] text-right">{todayTx.length} transaksi</div>
                </div>
              );
            })()}

            <div className="flex-1 overflow-y-auto divide-y divide-[#F0EBDD]">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10 text-[#8B8680] text-sm gap-2">
                  <Loader2 size={16} className="animate-spin" /> Memuat riwayat...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-10 text-[#B3AC98] text-sm">Belum ada transaksi tersimpan.</div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="py-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Struk #{String(h.no_struk).padStart(4, "0")}</span>
                      <span className="font-bold font-mono">{rupiah(h.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#8B8680]">
                      <span>{new Date(h.created_at).toLocaleString("id-ID")}</span>
                      <span>
                        {h.metode_bayar === "tunai" ? "Tunai" : "QRIS"} · {h.items.length} jasa
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
