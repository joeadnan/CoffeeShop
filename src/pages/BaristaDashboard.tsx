import { useCallback, useEffect, useMemo, useState } from "react";
import { Coffee, Lock, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";
import { rupiah, shortTime } from "../lib/format";
import type { Order, OrderItem, OrderStatus, PaymentStatus } from "../types";

type OrderWithItems = Order & {
  order_items?: OrderItem[];
};

const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "processing",
  "ready",
  "done",
  "cancelled",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "waiting_verification",
  "paid",
  "rejected",
];

const orderLabel: Record<OrderStatus, string> = {
  new: "Baru",
  processing: "Diproses",
  ready: "Siap",
  done: "Selesai",
  cancelled: "Batal",
};

const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: "Belum bayar",
  waiting_verification: "Perlu verifikasi",
  paid: "Lunas",
  rejected: "Ditolak",
};

function normalizePaymentStatus(status?: PaymentStatus | null): PaymentStatus {
  return status || "unpaid";
}

export function BaristaDashboard() {
  const [pin, setPin] = useState(
    () => localStorage.getItem("barista_pin_ok") === "yes",
  );
  const [pinInput, setPinInput] = useState("");
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);

  const orderCounts = useMemo(() => {
    return ORDER_STATUSES.reduce<Record<OrderStatus, number>>(
      (result, status) => {
        result[status] = orders.filter(
          (order) => order.status === status,
        ).length;
        return result;
      },
      {} as Record<OrderStatus, number>,
    );
  }, [orders]);

  const paymentCounts = useMemo(() => {
    return PAYMENT_STATUSES.reduce<Record<PaymentStatus, number>>(
      (result, status) => {
        result[status] = orders.filter(
          (order) => normalizePaymentStatus(order.payment_status) === status,
        ).length;
        return result;
      },
      {} as Record<PaymentStatus, number>,
    );
  }, [orders]);

  const login = useCallback(() => {
    if (pinInput !== config.adminPin) {
      alert("PIN salah");
      return;
    }

    localStorage.setItem("barista_pin_ok", "yes");
    setPin(true);
    setPinInput("");
  }, [pinInput]);

  const logout = useCallback(() => {
    localStorage.removeItem("barista_pin_ok");
    setPin(false);
    setOrders([]);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setOrders(data || []);
  }, []);

  const updateOrderStatus = useCallback(
    async (id: string, status: OrderStatus, currentStatus: OrderStatus) => {
      if (status === currentStatus) return;

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === id ? { ...order, status } : order,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    if (!pin) return;

    loadOrders();

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        loadOrders,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        loadOrders,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pin, loadOrders]);

  if (!pin) {
    return (
      <div className="safe max-w-md">
        <div className="card p-7 mt-20">
          <h1 className="text-2xl font-black flex gap-2">
            <Lock /> Login Barista
          </h1>

          <p className="my-3">Masukkan PIN dashboard.</p>

          <input
            className="input"
            type="password"
            placeholder="PIN"
            value={pinInput}
            onChange={(event) => setPinInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") login();
            }}
          />

          <button className="btn btn-primary w-full mt-4" onClick={login}>
            Masuk
          </button>

          <p className="text-xs mt-3">
            Default PIN: 123456, bisa diganti di .env
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="safe">
      <header className="flex justify-between items-center mb-5 gap-4">
        <div>
          <h1 className="text-3xl font-black flex gap-2">
            <Coffee /> Dashboard Barista
          </h1>
          <p>Pesanan masuk realtime dari QR ordering.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href="/products" className="btn btn-soft">
            Produk
          </a>

          <a href="/qr" className="btn btn-soft">
            QR Code
          </a>

          <button
            onClick={loadOrders}
            disabled={loading}
            className="btn btn-primary flex gap-2 disabled:opacity-40"
          >
            <RefreshCw size={18} />
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button onClick={logout} className="btn btn-soft flex gap-2">
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </header>

      <section className="grid md:grid-cols-5 gap-3 mb-3">
        {ORDER_STATUSES.map((status) => (
          <div className="card p-4" key={status}>
            <p className="text-sm">{orderLabel[status]}</p>
            <b className="text-2xl">{orderCounts[status]}</b>
          </div>
        ))}
      </section>

      <section className="grid md:grid-cols-4 gap-3 mb-5">
        {PAYMENT_STATUSES.map((status) => (
          <div className="card p-4" key={status}>
            <p className="text-sm">{paymentLabel[status]}</p>
            <b className="text-2xl">{paymentCounts[status]}</b>
          </div>
        ))}
      </section>

      {loading && <p className="mb-3">Loading...</p>}

      <section className="grid lg:grid-cols-2 gap-4">
        {orders.map((order) => {
          const paymentStatus = normalizePaymentStatus(order.payment_status);

          return (
            <div className="card p-5" key={order.id}>
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">#{order.order_number}</h2>
                  <p>
                    {shortTime(order.created_at)} •{" "}
                    {order.distance_meter ?? "-"} meter
                  </p>
                </div>

                <div className="text-right space-y-2">
                  <span className={`pill badge-${order.status}`}>
                    {orderLabel[order.status]}
                  </span>
                  <br />
                  <span className={`pill payment-${paymentStatus}`}>
                    {paymentLabel[paymentStatus]}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p>
                  <b>Nama:</b> {order.customer_name}
                </p>
                <p>
                  <b>Area:</b> {order.area_name}
                </p>
                <p>
                  <b>Bayar:</b> {(order.payment_method || "qris").toUpperCase()}
                </p>
                <p>
                  <b>Ref:</b> {order.payment_reference || "-"}
                </p>
              </div>

              {order.note && (
                <p className="mt-2 text-sm">
                  <b>Catatan:</b> {order.note}
                </p>
              )}

              <div className="mt-4 border-t pt-3 space-y-2">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {item.qty}x {item.product_name}
                    </span>
                    <b>{rupiah(item.subtotal)}</b>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-between text-lg font-black">
                <span>Total</span>
                <span>{rupiah(order.total_amount)}</span>
              </div>

              <div className="mt-4">
                <p className="text-sm font-bold mb-2">Pembayaran</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm">
                    Status otomatis dari Midtrans webhook.
                  </span>

                  <a
                    className="btn btn-soft text-sm"
                    href={`/payment/${order.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lihat QR
                  </a>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-bold mb-2">Status order</p>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.map((status) => (
                    <button
                      key={status}
                      className="btn btn-soft text-sm disabled:opacity-40"
                      disabled={status === order.status}
                      onClick={() =>
                        updateOrderStatus(order.id, status, order.status)
                      }
                    >
                      {orderLabel[status]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
