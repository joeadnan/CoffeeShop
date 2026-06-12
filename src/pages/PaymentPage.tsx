import { useEffect, useState } from 'react';
import { CheckCircle2, Coffee, Copy, QrCode, RefreshCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { createMidtransQris } from '../lib/payment';
import { rupiah, shortTime } from '../lib/format';
import type { Order, OrderItem, PaymentStatus } from '../types';

type OrderWithItems = Order & { order_items?: OrderItem[] };

const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: 'Menunggu pembayaran',
  waiting_verification: 'Menunggu verifikasi',
  paid: 'Lunas',
  rejected: 'Pembayaran gagal/expired',
};

export function PaymentPage() {
  const id = window.location.pathname.split('/payment/')[1];
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingQris, setCreatingQris] = useState(false);
  const [qrisError, setQrisError] = useState<string | null>(null);

  async function load() {
    if (!id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single();

    setLoading(false);

    if (error) {
      alert(`Gagal memuat pembayaran: ${error.message}`);
      return;
    }

    setOrder(data);
  }

  async function ensureQris(orderId: string) {
    setCreatingQris(true);
    setQrisError(null);

    try {
      await createMidtransQris(orderId);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membuat QRIS Midtrans.';
      setQrisError(message);
    } finally {
      setCreatingQris(false);
    }
  }

  useEffect(() => {
    load();

    if (!id) return;

    const channel = supabase
      .channel(`payment-status-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!order) return;
    if (order.payment_status === 'paid') return;
    if (order.payment_qr_image_url || order.payment_qr_string) return;
    if (creatingQris) return;

    ensureQris(order.id);
  }, [order?.id, order?.payment_qr_image_url, order?.payment_qr_string, order?.payment_status]);

  async function copyRef() {
    if (!order?.payment_reference) return;
    await navigator.clipboard.writeText(order.payment_reference);
    alert('Kode referensi disalin.');
  }

  if (loading && !order) return <div className="safe"><p>Loading pembayaran...</p></div>;

  if (!order) {
    return <div className="safe max-w-xl"><div className="card p-7 mt-10"><h1 className="text-2xl font-black">Order tidak ditemukan</h1><a className="btn btn-primary inline-block mt-4" href="/">Kembali order</a></div></div>;
  }

  return <div className="safe max-w-3xl">
    <div className="card p-6 mt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black flex gap-2"><Coffee /> Pembayaran QRIS Midtrans</h1>
          <p>Order <b>#{order.order_number}</b> • {shortTime(order.created_at)}</p>
        </div>
        <span className={`pill payment-${order.payment_status}`}>{paymentLabel[order.payment_status]}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <section className="text-center border rounded-2xl p-5 bg-[#fffaf3]">
          <h2 className="font-black text-xl flex justify-center gap-2"><QrCode /> Scan QRIS</h2>
          <p className="text-sm my-2">Nominal otomatis sesuai total pesanan.</p>

          {creatingQris && <div className="rounded-2xl border bg-white p-8"><p className="font-bold">Membuat QRIS Midtrans...</p></div>}

          {!creatingQris && qrisError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left">
            <b>QRIS gagal dibuat</b>
            <p className="text-sm mt-1">{qrisError}</p>
            <button className="btn btn-primary mt-3" onClick={() => ensureQris(order.id)}>Coba lagi</button>
          </div>}

          {!creatingQris && !qrisError && order.payment_qr_image_url && <img src={order.payment_qr_image_url} alt="QRIS Midtrans" className="mx-auto max-w-[280px] rounded-2xl border bg-white p-3" />}

          {!creatingQris && !qrisError && !order.payment_qr_image_url && order.payment_qr_string && <div className="inline-block bg-white p-4 rounded-2xl border"><QRCodeCanvas value={order.payment_qr_string} size={260} /></div>}

          {!creatingQris && !qrisError && !order.payment_qr_image_url && !order.payment_qr_string && <div className="rounded-2xl border bg-white p-8"><p className="font-bold">QRIS belum tersedia.</p><button className="btn btn-primary mt-3" onClick={() => ensureQris(order.id)}>Generate QRIS</button></div>}

          <p className="text-sm mt-3">Setelah pembayaran berhasil, status akan otomatis berubah menjadi lunas dari notifikasi Midtrans.</p>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border p-4">
            <p className="text-sm">Total bayar</p>
            <b className="text-3xl">{rupiah(order.total_amount)}</b>
          </div>

          <div className="rounded-2xl border p-4">
            <p className="text-sm">Referensi pembayaran</p>
            <div className="flex items-center justify-between gap-2">
              <b className="break-all">{order.payment_reference || order.order_number}</b>
              <button className="btn btn-soft p-2" onClick={copyRef}><Copy size={16} /></button>
            </div>
          </div>

          <div className="rounded-2xl border p-4 space-y-2">
            <b>Ringkasan pesanan</b>
            {order.order_items?.map((item) => <div key={item.id} className="flex justify-between text-sm"><span>{item.qty}x {item.product_name}</span><b>{rupiah(item.subtotal)}</b></div>)}
          </div>

          {order.payment_status === 'paid'
            ? <div className="btn btn-primary w-full text-center flex items-center justify-center gap-2"><CheckCircle2 /> Pembayaran sudah lunas</div>
            : <div className="rounded-2xl border p-4 text-sm bg-[#fffaf3]">Tidak perlu klik konfirmasi manual. Sistem akan update otomatis setelah Midtrans mengirim webhook.</div>}

          <button onClick={load} className="btn btn-soft w-full flex justify-center gap-2"><RefreshCw size={18} /> Refresh status</button>
          <a className="btn btn-soft w-full block text-center" href="/">Order lagi</a>
        </section>
      </div>
    </div>
  </div>;
}
