import React, { useState, useMemo, useEffect } from "react";
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
  Layers,
  History,
  Loader2,
  FileSpreadsheet,
  FileText,
  ShoppingCart,
  Image as ImageIcon,
  Printer,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./supabaseClient";

// ---------- Katalog produk ----------
// Foto produk: taruh file di folder /public/products/ dengan nama sesuai "slug" di bawah
// (contoh: public/products/bulat-30-1p.jpg). Kalau foto belum ada, otomatis tampil ikon placeholder.
function buildProducts() {
  const specs = [
    { bentuk: "Bulat", liter: 30, pilahMin: 1, pilahMax: 3, cat: "Bulat 30L" },
    { bentuk: "Bulat", liter: 50, pilahMin: 1, pilahMax: 5, cat: "Bulat 50L" },
    { bentuk: "Bulat", liter: 80, pilahMin: 1, pilahMax: 5, cat: "Bulat 80L" },
    { bentuk: "Oval", liter: 60, pilahMin: 1, pilahMax: 5, cat: "Oval 60L" },
    { bentuk: "Kaleng", liter: 20, pilahMin: 2, pilahMax: 3, cat: "Kaleng 20L" },
  ];
  let id = 1;
  const list = [];
  specs.forEach((s) => {
    for (let p = s.pilahMin; p <= s.pilahMax; p++) {
      const slug = `${s.bentuk.toLowerCase()}-${s.liter}-${p}p`;
      list.push({
        id: id++,
        name: `Tempat Sampah ${s.bentuk} ${s.liter}L - ${p} Pilah`,
        price: 0, // harga menyusul, bisa diisi manual saat transaksi
        cat: s.cat,
        pilah: p,
        image: `/products/${slug}.jpg`,
      });
    }
  });
  return list;
}

const CATEGORIES = ["Semua", "Bulat 30L", "Bulat 50L", "Bulat 80L", "Oval 60L", "Kaleng 20L"];
const PRODUCTS = buildProducts();

function rupiah(n) {
  return "Rp" + Math.round(n || 0).toLocaleString("id-ID");
}

// ---------- Komponen gambar dengan fallback ----------
function ProductThumb({ src, alt, className }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-[#F1EEE6] text-[#B3AC98] gap-1`}>
        <ImageIcon size={20} />
        <span className="text-[9px]">Foto menyusul</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
}

function StoreLogo({ className }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className={`${className} bg-[#E8A33D] flex items-center justify-center text-[#1F3D34] font-bold font-display`}>
        CPF
      </div>
    );
  }
  return (
    <img
      src="/logo.png"
      alt="Logo Cahaya Putra Fiberglass"
      className={`${className} object-cover`}
      onError={() => setError(true)}
    />
  );
}

function ReceiptLogo() {
  const [error, setError] = useState(false);
  if (error) return null;
  return (
    <img
      src="/logo.png"
      alt="Logo"
      className="w-14 h-14 object-contain mx-auto mb-2"
      onError={() => setError(true)}
    />
  );
}

// ---------- Isi struk (dipakai untuk struk baru & lihat riwayat) ----------
function ReceiptBody({ tx }) {
  return (
    <div id="receipt-print-area" className="p-5 font-mono">
      <div className="text-center mb-3">
        <ReceiptLogo />
        <div className="font-bold text-sm font-display">CAHAYA PUTRA FIBERGLASS</div>
        <div className="text-[10px] text-[#8B8680]">Jasa Custom & Cetak Fiberglass</div>
        <div className="text-[10px] text-[#8B8680]">{new Date(tx.created_at).toLocaleString("id-ID")}</div>
        <div className="text-[10px] text-[#8B8680]">Struk #{String(tx.no_struk).padStart(4, "0")}</div>
      </div>
      <div className="border-t border-dashed border-[#D8D0BA] my-2" />
      {tx.items.map((i, idx) => (
        <div key={idx} className="text-xs mb-1">
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
        <span>{rupiah(tx.subtotal)}</span>
      </div>
      {tx.discount_pct > 0 && (
        <div className="flex justify-between text-xs">
          <span>Diskon ({tx.discount_pct}%)</span>
          <span>-{rupiah(tx.discount_amt)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-bold mt-1">
        <span>TOTAL</span>
        <span>{rupiah(tx.total)}</span>
      </div>
      <div className="border-t border-dashed border-[#D8D0BA] my-2" />
      <div className="flex justify-between text-xs">
        <span>{tx.metode_bayar === "tunai" ? "Tunai" : "QRIS"}</span>
        <span>{rupiah(tx.cash)}</span>
      </div>
      {tx.metode_bayar === "tunai" && (
        <div className="flex justify-between text-xs">
          <span>Kembali</span>
          <span>{rupiah(tx.kembalian)}</span>
        </div>
      )}
      <div className="text-center text-[10px] text-[#8B8680] mt-4">Terima kasih atas kepercayaannya!</div>
    </div>
  );
}

export default function App() {
  const [activeCat, setActiveCat] = useState("Semua");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [payMethod, setPayMethod] = useState("tunai");
  const [cashInput, setCashInput] = useState("");
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [showPay, setShowPay] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [viewingTx, setViewingTx] = useState(null);
  const [txCounter, setTxCounter] = useState(1);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  function exportExcel() {
    const rows = history.map((h) => ({
      "No Struk": h.no_struk,
      Tanggal: new Date(h.created_at).toLocaleString("id-ID"),
      Jasa: h.items.map((i) => `${i.name} x${i.qty}`).join(", "),
      Subtotal: h.subtotal,
      "Diskon (%)": h.discount_pct,
      Total: h.total,
      "Metode Bayar": h.metode_bayar === "tunai" ? "Tunai" : "QRIS",
      "Uang Diterima": h.cash,
      Kembalian: h.kembalian,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 10 }, { wch: 20 }, { wch: 45 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, `transaksi-cpf-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Cahaya Putra Fiberglass - Riwayat Transaksi", 14, 15);
    doc.setFontSize(9);
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 21);
    const body = history.map((h) => [
      String(h.no_struk).padStart(4, "0"),
      new Date(h.created_at).toLocaleString("id-ID"),
      h.items.map((i) => `${i.name} x${i.qty}`).join("\n"),
      rupiah(h.total),
      h.metode_bayar === "tunai" ? "Tunai" : "QRIS",
    ]);
    autoTable(doc, {
      startY: 27,
      head: [["No Struk", "Tanggal", "Jasa", "Total", "Bayar"]],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [31, 61, 52] },
      columnStyles: { 2: { cellWidth: 70 } },
    });
    const totalOmzet = history.reduce((s, h) => s + Number(h.total), 0);
    const finalY = doc.lastAutoTable.finalY || 30;
    doc.setFontSize(10);
    doc.text(`Total Omzet Keseluruhan: ${rupiah(totalOmzet)}`, 14, finalY + 8);
    doc.save(`transaksi-cpf-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const filtered = useMemo(() => {
    return PRODUCTS.filter(
      (p) => (activeCat === "Semua" || p.cat === activeCat) && p.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [activeCat, query]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = (subtotal * discountPct) / 100;
  const total = subtotal - discountAmt;
  const cash = parseFloat(cashInput.replace(/[^0-9]/g, "")) || 0;
  const change = cash - total;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function getQtyInCart(id) {
    const item = cart.find((i) => i.id === id);
    return item ? item.qty : 0;
  }

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, image: product.image }];
    });
  }

  function changeQty(id, delta) {
    setCart((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)).filter((i) => i.qty > 0)
    );
  }

  function setExactQty(product, value) {
    const num = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
    const qty = isNaN(num) ? 0 : num;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (qty <= 0) {
        return prev.filter((i) => i.id !== product.id);
      }
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty } : i));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty, image: product.image }];
    });
  }

  function setItemQty(id, value) {
    const num = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
    const qty = isNaN(num) ? 0 : num;
    setCart((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
  }

  function setItemPrice(id, value) {
    const num = parseFloat(String(value).replace(/[^0-9]/g, "")) || 0;
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, price: num } : i)));
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function addManualItem() {
    const name = manualName.trim();
    const price = parseFloat(manualPrice.replace(/[^0-9]/g, "")) || 0;
    const qty = parseInt(manualQty, 10) || 1;
    if (!name) return;
    const manualId = `manual-${Date.now()}`;
    setCart((prev) => [...prev, { id: manualId, name, price, qty, image: null }]);
    setManualName("");
    setManualPrice("");
    setManualQty("1");
    setShowManualAdd(false);
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
    setShowCartDrawer(false);
    setShowReceipt(true);
  }

  function finishReceipt() {
    setShowReceipt(false);
    resetTransaction();
  }

  function printReceipt() {
    window.print();
  }

  return (
    <div className="min-h-screen w-full bg-[#F1EEE6] text-[#231F1A]">
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-[#1F3D34] text-[#F1EEE6] shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <StoreLogo className="w-9 h-9 rounded-md shrink-0" />
          <div>
            <h1 className="text-lg font-bold tracking-tight font-display">Cahaya Putra Fiberglass</h1>
            <p className="text-xs text-[#C9C2AE]">Kasir · Jasa Custom & Cetak Fiberglass</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md"
          >
            <History size={14} /> Riwayat
          </button>
          <button
            onClick={() => setShowCartDrawer(true)}
            className="relative flex items-center gap-1.5 text-xs bg-[#E8A33D] text-[#1F3D34] font-semibold px-3 py-1.5 rounded-md hover:brightness-95"
          >
            <ShoppingCart size={14} /> Struk
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#C1443A] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {errorMsg && <div className="bg-[#FBEAE8] text-[#C1443A] text-sm px-6 py-2 print:hidden">{errorMsg}</div>}

      <div className="p-4 lg:p-6 print:hidden">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8680]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari produk..."
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((p) => {
            const qty = getQtyInCart(p.id);
            return (
              <div
                key={p.id}
                className="text-left bg-white rounded-xl border border-[#E4DECD] overflow-hidden hover:border-[#1F3D34] hover:shadow-md transition-all"
              >
                <ProductThumb src={p.image} alt={p.name} className="w-full h-24 object-cover" />
                <div className="p-3">
                  <div className="text-sm font-medium leading-snug mb-1">{p.name}</div>
                  <div className="flex items-center justify-between mt-2 mb-2.5">
                    {p.price > 0 ? (
                      <span className="text-sm font-semibold text-[#1F3D34] font-mono">{rupiah(p.price)}</span>
                    ) : (
                      <span className="text-xs font-medium text-[#E8A33D]">Harga menyusul</span>
                    )}
                    <span className="text-[10px] text-[#B3AC98] flex items-center gap-1">
                      <Layers size={10} /> {p.pilah} Pilah
                    </span>
                  </div>

                  {qty === 0 ? (
                    <button
                      onClick={() => addToCart(p)}
                      className="w-full py-1.5 rounded-md bg-[#1F3D34] text-white text-xs font-semibold flex items-center justify-center gap-1 hover:brightness-110"
                    >
                      <Plus size={12} /> Tambah
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-[#F1EEE6] rounded-md px-1 py-1">
                      <button
                        onClick={() => changeQty(p.id, -1)}
                        className="w-7 h-7 rounded-md bg-white hover:bg-[#E4DECD] flex items-center justify-center shadow-sm"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        value={qty}
                        onChange={(e) => setExactQty(p, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        inputMode="numeric"
                        className="w-8 text-center text-sm font-bold text-[#1F3D34] bg-transparent outline-none"
                      />
                      <button
                        onClick={() => addToCart(p)}
                        className="w-7 h-7 rounded-md bg-white hover:bg-[#E4DECD] flex items-center justify-center shadow-sm"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-[#8B8680] text-sm">Produk tidak ditemukan.</div>
          )}
        </div>
      </div>

      {/* Drawer Struk (dipindah dari sidebar ke navbar) */}
      {showCartDrawer && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-40 print:hidden">
          <div className="bg-white w-full max-w-sm h-full flex flex-col">
            <div className="px-4 py-3 border-b border-dashed border-[#D8D0BA] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ReceiptIcon size={16} className="text-[#1F3D34]" />
                <span className="font-semibold text-sm font-display">Struk #{String(txCounter).padStart(4, "0")}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowManualAdd(true)}
                  className="text-xs text-[#1F3D34] font-semibold hover:underline"
                >
                  + Manual
                </button>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-[#C1443A] hover:underline">
                    Kosongkan
                  </button>
                )}
                <button onClick={() => setShowCartDrawer(false)}>
                  <X size={18} className="text-[#8B8680]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-[#F0EBDD]">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-[#B3AC98] text-sm">
                  Belum ada produk dipilih.
                  <br />
                  Ketuk produk untuk menambah.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center gap-2">
                    {String(item.id).startsWith("manual-") ? (
                      <div className="w-10 h-10 rounded-md bg-[#EAF1EE] text-[#1F3D34] text-[9px] font-bold flex items-center justify-center shrink-0">
                        MANUAL
                      </div>
                    ) : (
                      <ProductThumb src={item.image} alt={item.name} className="w-10 h-10 rounded-md object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-[#8B8680]">Rp</span>
                        <input
                          value={item.price === 0 ? "" : item.price}
                          onChange={(e) => setItemPrice(item.id, e.target.value)}
                          placeholder="isi harga"
                          inputMode="numeric"
                          className="w-20 text-xs border border-[#DDD6C4] rounded px-1.5 py-0.5 font-mono"
                        />
                        <span className="text-xs text-[#8B8680]">x {item.qty}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => changeQty(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-[#F1EEE6] hover:bg-[#E4DECD] flex items-center justify-center"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        value={item.qty}
                        onChange={(e) => setItemQty(item.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        inputMode="numeric"
                        className="w-7 text-center text-sm font-medium bg-transparent outline-none"
                      />
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

            <div className="px-4 py-3 border-t border-dashed border-[#D8D0BA] space-y-2 shrink-0">
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
              <button
                disabled={cart.length === 0}
                onClick={() => setShowPay(true)}
                className="w-full mt-1 py-3 rounded-lg bg-[#E8A33D] text-[#231F1A] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition-all shadow-sm font-display"
              >
                Bayar {cart.length > 0 ? rupiah(total) : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Item Manual */}
      {showManualAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg font-display">Tambah Item Manual</h2>
              <button onClick={() => setShowManualAdd(false)}>
                <X size={18} className="text-[#8B8680]" />
              </button>
            </div>

            <label className="text-xs text-[#8B8680] mb-1 block">Nama Item</label>
            <input
              autoFocus
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Contoh: Ongkos Kirim, Jasa Pasang, dll"
              className="w-full border border-[#DDD6C4] rounded-lg px-3 py-2.5 text-sm mb-3"
            />

            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <label className="text-xs text-[#8B8680] mb-1 block">Harga</label>
                <input
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full border border-[#DDD6C4] rounded-lg px-3 py-2.5 text-sm font-mono"
                />
              </div>
              <div className="w-20">
                <label className="text-xs text-[#8B8680] mb-1 block">Qty</label>
                <input
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="w-full border border-[#DDD6C4] rounded-lg px-3 py-2.5 text-sm font-mono text-center"
                />
              </div>
            </div>

            <button
              onClick={addManualItem}
              disabled={!manualName.trim()}
              className="w-full py-3 rounded-lg bg-[#1F3D34] text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed font-display"
            >
              Tambahkan ke Struk
            </button>
          </div>
        </div>
      )}

      {showPay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:hidden">
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

      {/* Struk baru selesai dibayar */}
      {showReceipt && lastTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-xl w-full max-w-xs overflow-hidden print:rounded-none print:max-w-full print:shadow-none">
            <ReceiptBody tx={lastTx} />
            <div className="px-5 pb-5 flex gap-2 print:hidden">
              <button
                onClick={printReceipt}
                className="flex-1 py-2.5 rounded-lg border border-[#1F3D34] text-[#1F3D34] font-bold text-sm flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Cetak
              </button>
              <button
                onClick={finishReceipt}
                className="flex-1 py-2.5 rounded-lg bg-[#1F3D34] text-white font-bold text-sm font-display"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lihat ulang struk dari riwayat */}
      {viewingTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-xl w-full max-w-xs overflow-hidden print:rounded-none print:max-w-full print:shadow-none">
            <ReceiptBody tx={viewingTx} />
            <div className="px-5 pb-5 flex gap-2 print:hidden">
              <button
                onClick={printReceipt}
                className="flex-1 py-2.5 rounded-lg border border-[#1F3D34] text-[#1F3D34] font-bold text-sm flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Cetak
              </button>
              <button
                onClick={() => setViewingTx(null)}
                className="flex-1 py-2.5 rounded-lg bg-[#1F3D34] text-white font-bold text-sm font-display"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat transaksi */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-md p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg font-display">Riwayat Transaksi</h2>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <>
                    <button
                      onClick={exportExcel}
                      title="Export Excel"
                      className="flex items-center gap-1 text-xs bg-[#EAF1EE] text-[#1F3D34] px-2.5 py-1.5 rounded-md hover:bg-[#DCEAE3]"
                    >
                      <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button
                      onClick={exportPDF}
                      title="Export PDF"
                      className="flex items-center gap-1 text-xs bg-[#FBEAE8] text-[#C1443A] px-2.5 py-1.5 rounded-md hover:bg-[#F8DCD9]"
                    >
                      <FileText size={14} /> PDF
                    </button>
                  </>
                )}
                <button onClick={() => setShowHistory(false)}>
                  <X size={18} className="text-[#8B8680]" />
                </button>
              </div>
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
                  <button
                    key={h.id}
                    onClick={() => {
                      setViewingTx(h);
                      setShowHistory(false);
                    }}
                    className="w-full text-left py-2.5 hover:bg-[#F7F5EE] rounded-md px-2 -mx-2"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Struk #{String(h.no_struk).padStart(4, "0")}</span>
                      <span className="font-bold font-mono">{rupiah(h.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#8B8680]">
                      <span>{new Date(h.created_at).toLocaleString("id-ID")}</span>
                      <span>
                        {h.metode_bayar === "tunai" ? "Tunai" : "QRIS"} · {h.items.length} produk
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
