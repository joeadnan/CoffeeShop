import { useEffect, useMemo, useState } from "react";
import { Coffee, MapPin, Minus, Plus, ShoppingBag } from "lucide-react";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";
import { distanceMeter, getCurrentPosition } from "../lib/location";
import { rupiah } from "../lib/format";
import type { CartItem, Product } from "../types";

const fallbackProducts: Product[] = [
  {
    id: "demo-1",
    name: "Americano",
    description: "Espresso dan air panas",
    price: 18000,
    image_url: null,
    is_active: true,
    sort_order: 1,
  },
  {
    id: "demo-2",
    name: "Cafe Latte",
    description: "Espresso, susu steamed, foam tipis",
    price: 25000,
    image_url: null,
    is_active: true,
    sort_order: 2,
  },
  {
    id: "demo-3",
    name: "Cappuccino",
    description: "Espresso, milk foam tebal",
    price: 24000,
    image_url: null,
    is_active: true,
    sort_order: 3,
  },
  {
    id: "demo-4",
    name: "Kopi Susu Gula Aren",
    description: "Signature coffee milk",
    price: 22000,
    image_url: null,
    is_active: true,
    sort_order: 4,
  },
];

type LocationStatus = "idle" | "checking" | "allowed" | "denied";

export function OrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [areaName, setAreaName] = useState("");
  const [note, setNote] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locMsg, setLocMsg] = useState("Tekan cek lokasi untuk mulai order.");
  const [loading, setLoading] = useState(false);

  const allowed = locationStatus === "allowed";
  // bypas lokasi
  const canOrder = config.developmentMode || allowed;
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart],
  );

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    setProducts(!error && data?.length ? data : fallbackProducts);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function checkLocation() {
    setLocationStatus("checking");
    setLocMsg("Meminta izin lokasi GPS...");

    try {
      const storeLat = Number(config.storeLat);
      const storeLng = Number(config.storeLng);

      if (Number.isNaN(storeLat) || Number.isNaN(storeLng)) {
        throw new Error("Koordinat coffee shop belum valid di file config.");
      }

      const pos = await getCurrentPosition();
      const currentDistance = distanceMeter(
        pos.coords.latitude,
        pos.coords.longitude,
        storeLat,
        storeLng,
      );

      setDistance(currentDistance);

      if (currentDistance <= config.accessRadiusMeter) {
        setLocationStatus("allowed");
        setLocMsg(
          `Lokasi valid. Jarak sekitar ${currentDistance} meter dari coffee shop.`,
        );
      } else {
        setLocationStatus("denied");
        setLocMsg(
          `Di luar area. Jarak sekitar ${currentDistance} meter, maksimal ${config.accessRadiusMeter} meter.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal membaca lokasi.";
      setDistance(null);
      setLocationStatus("denied");
      setLocMsg(
        `${message} Pastikan izin lokasi aktif dan akses via HTTPS / localhost.`,
      );
    }
  }

  function addProduct(product: Product) {
    // if (!allowed) { disable sementara
    if (!canOrder) {
      alert("Silakan cek lokasi terlebih dahulu.");
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);

      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }

      return [...currentCart, { ...product, qty: 1 }];
    });
  }

  function decreaseProduct(id: string) {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.id !== id) return [item];
        if (item.qty <= 1) return [];
        return [{ ...item, qty: item.qty - 1 }];
      }),
    );
  }

  async function submitOrder() {
    if (!allowed)
      return alert("Order hanya bisa dilakukan di sekitar coffee shop.");
    if (!customerName.trim() || !areaName.trim())
      return alert("Nama dan area/lokasi wajib diisi.");
    if (cart.length === 0) return alert("Pilih produk dulu.");

    setLoading(true);

    try {
      const orderNumber = `CF-${Date.now().toString().slice(-8)}`;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_name: customerName.trim(),
          area_name: areaName.trim(),
          note: note.trim() || null,
          total_amount: total,
          status: "new",
          distance_meter: distance,
          payment_method: "qris",
          payment_status: "unpaid",
          payment_provider: "midtrans",
          payment_reference: orderNumber,
        })
        .select()
        .single();

      if (orderError || !order)
        throw new Error(orderError?.message || "Gagal simpan order.");

      const rows = cart.map((item) => ({
        order_id: order.id,
        product_id: item.id.startsWith("demo-") ? null : item.id,
        product_name: item.name,
        qty: item.qty,
        price: item.price,
        subtotal: item.qty * item.price,
      }));

      const { error: itemError } = await supabase
        .from("order_items")
        .insert(rows);
      if (itemError)
        throw new Error(
          `Order tersimpan tapi item gagal: ${itemError.message}`,
        );

      setCart([]);
      setCustomerName("");
      setAreaName("");
      setNote("");
      window.location.href = `/payment/${order.id}`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan.";
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="safe">
      <header className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <Coffee /> {config.storeName}
          </h1>
          <p className="text-coffee-700">
            QR Ordering khusus area coffee shop.
          </p>
        </div>
        <a href="/barista" className="btn btn-soft">
          Dashboard Barista
        </a>
      </header>

      <section className="card p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-black text-xl flex gap-2">
              <MapPin /> Validasi radius
            </h2>
            <p className="text-sm mt-1">
              Aplikasi hanya bisa dipakai jika customer berada maksimal{" "}
              {config.accessRadiusMeter} meter dari coffee shop.
            </p>
            <p className="mt-3 font-semibold">{locMsg}</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={checkLocation}
            disabled={locationStatus === "checking"}
          >
            {locationStatus === "checking" ? "Mengecek..." : "Cek Lokasi"}
          </button>
        </div>
      </section>

      <main className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
          {products.map((product) => (
            <div key={product.id} className="card p-4">
              <div className="h-32 rounded-2xl bg-coffee-100 mb-3 flex items-center justify-center overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Coffee size={42} />
                )}
              </div>
              <h3 className="font-black text-lg">{product.name}</h3>
              <p className="text-sm min-h-10">{product.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <b>{rupiah(product.price)}</b>
                <button
                  type="button"
                  onClick={() => addProduct(product)}
                  className="btn btn-primary"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          ))}
        </section>

        <aside className="card p-5 h-fit sticky top-4">
          <h2 className="font-black text-xl flex gap-2">
            <ShoppingBag /> Pesanan
          </h2>
          <div className="mt-4 space-y-3">
            <input
              className="input"
              placeholder="Nama customer"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
            <input
              className="input"
              placeholder="Area/lokasi, contoh: Meja 3 / Outdoor"
              value={areaName}
              onChange={(event) => setAreaName(event.target.value)}
            />
            <textarea
              className="input"
              placeholder="Catatan opsional"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="mt-4 space-y-3">
            {cart.length === 0 && <p className="text-sm">Belum ada produk.</p>}
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center border-b pb-2"
              >
                <div>
                  <b>{item.name}</b>
                  <p className="text-sm">
                    {rupiah(item.price)} x {item.qty}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-soft p-2"
                    onClick={() => decreaseProduct(item.id)}
                  >
                    <Minus size={14} />
                  </button>
                  <span>{item.qty}</span>
                  <button
                    type="button"
                    className="btn btn-soft p-2"
                    onClick={() => addProduct(item)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xl font-black mt-5">
            <span>Total</span>
            <span>{rupiah(total)}</span>
          </div>
          <button
            type="button"
            disabled={!canOrder}
            // disabled={!allowed || loading}
            onClick={submitOrder}
            className="btn btn-primary w-full mt-4 disabled:opacity-40"
          >
            {loading ? "Mengirim..." : "Kirim Pesanan"}
          </button>
        </aside>
      </main>
    </div>
  );
}
