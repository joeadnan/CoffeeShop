import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Coffee,
  Edit3,
  ImagePlus,
  Lock,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { config } from "../lib/config";
import { rupiah } from "../lib/format";
import type { Product } from "../types";

type ProductForm = {
  name: string;
  description: string;
  price: string;
  image_url: string;
  is_active: boolean;
  sort_order: string;
};

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  is_active: true,
  sort_order: "0",
};

const PRODUCT_IMAGE_BUCKET = "product-images";

function toForm(product: Product): ProductForm {
  return {
    name: product.name,
    description: product.description || "",
    price: String(product.price || 0),
    image_url: product.image_url || "",
    is_active: product.is_active,
    sort_order: String(product.sort_order || 0),
  };
}

function makeSafeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");
}

export function ProductAdminPage() {
  const [pin, setPin] = useState(
    localStorage.getItem("barista_pin_ok") === "yes",
  );
  const [pinInput, setPinInput] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const [keyword, setKeyword] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) =>
      `${product.name} ${product.description || ""}`.toLowerCase().includes(q),
    );
  }, [products, keyword]);

  function login() {
    if (pinInput === config.adminPin) {
      localStorage.setItem("barista_pin_ok", "yes");
      setPin(true);
      return;
    }

    alert("PIN salah");
  }

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert("Gagal memuat produk: " + error.message);
      return;
    }

    setProducts(data || []);
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
  }

  function editProduct(product: Product) {
    setEditing(product);
    setForm(toForm(product));
    setImageFile(null);
    setImagePreview(product.image_url || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleImageChange(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar.");
      return;
    }

    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("Ukuran gambar maksimal 2MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadProductImage(file: File) {
    const safeName = makeSafeFileName(file.name);
    const filePath = `products/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    const name = form.name.trim();
    const price = Number(form.price || 0);
    const sortOrder = Number(form.sort_order || 0);

    if (!name) return alert("Nama produk wajib diisi.");
    if (!Number.isFinite(price) || price < 0)
      return alert("Harga produk tidak valid.");

    setSaving(true);

    try {
      let imageUrl = form.image_url.trim() || null;

      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile);
      }

      const payload = {
        name,
        description: form.description.trim() || null,
        price,
        image_url: imageUrl,
        is_active: form.is_active,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      };

      const result = editing
        ? await supabase.from("products").update(payload).eq("id", editing.id)
        : await supabase.from("products").insert(payload);

      if (result.error) {
        alert("Gagal menyimpan produk: " + result.error.message);
        return;
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal upload gambar.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product: Product) {
    if (
      !confirm(
        `Hapus produk ${product.name}? Produk yang sudah ada di riwayat order tetap tersimpan sebagai nama item.`,
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      alert("Gagal hapus produk: " + error.message);
      return;
    }

    loadProducts();
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (error) {
      alert(error.message);
      return;
    }

    loadProducts();
  }

  useEffect(() => {
    if (pin) loadProducts();
  }, [pin]);

  if (!pin) {
    return (
      <div className="safe max-w-md">
        <div className="card p-7 mt-20">
          <h1 className="text-2xl font-black flex gap-2">
            <Lock /> Login Admin Produk
          </h1>

          <p className="my-3">Masukkan PIN dashboard.</p>

          <input
            className="input"
            type="password"
            placeholder="PIN"
            value={pinInput}
            onChange={(event) => setPinInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && login()}
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
      <header className="flex justify-between items-center mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black flex gap-2">
            <Coffee /> Produk
          </h1>
          <p>Tambah, edit, nonaktifkan, dan hapus menu coffee shop.</p>
        </div>

        <div className="flex gap-2">
          <a href="/barista" className="btn btn-soft">
            Dashboard
          </a>

          <a href="/" className="btn btn-soft">
            Order Page
          </a>

          <button onClick={loadProducts} className="btn btn-primary flex gap-2">
            <RefreshCw size={18} /> Refresh
          </button>
        </div>
      </header>

      <section className="card p-5 mb-5">
        <h2 className="font-black text-xl flex gap-2 mb-4">
          {editing ? <Edit3 /> : <PackagePlus />}
          {editing ? "Edit Produk" : "Tambah Produk"}
        </h2>

        <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
          <input
            className="input"
            placeholder="Nama produk"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />

          <input
            className="input"
            placeholder="Harga, contoh: 25000"
            type="number"
            min="0"
            value={form.price}
            onChange={(event) =>
              setForm({ ...form, price: event.target.value })
            }
          />

          <input
            className="input"
            placeholder="URL gambar produk opsional"
            value={form.image_url}
            onChange={(event) => {
              setForm({ ...form, image_url: event.target.value });
              setImagePreview(event.target.value);
            }}
          />

          <input
            className="input"
            placeholder="Urutan tampil"
            type="number"
            value={form.sort_order}
            onChange={(event) =>
              setForm({ ...form, sort_order: event.target.value })
            }
          />

          <div className="md:col-span-2">
            <label className="font-bold text-sm flex gap-2 mb-2">
              <ImagePlus size={18} />
              Upload gambar produk
            </label>

            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) => handleImageChange(event.target.files?.[0])}
            />

            {imagePreview && (
              <div className="mt-3 h-44 rounded-2xl bg-coffee-100 overflow-hidden flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Preview produk"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <textarea
            className="input md:col-span-2"
            placeholder="Deskripsi produk"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />

          <label className="flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm({ ...form, is_active: event.target.checked })
              }
            />
            Produk aktif dan tampil di halaman order
          </label>

          <div className="flex gap-2 md:justify-end">
            <button
              type="button"
              className="btn btn-soft flex gap-2"
              onClick={resetForm}
            >
              <X size={18} /> Batal
            </button>

            <button
              disabled={saving}
              className="btn btn-primary flex gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving
                ? "Menyimpan..."
                : editing
                  ? "Update Produk"
                  : "Simpan Produk"}
            </button>
          </div>
        </form>
      </section>

      <section className="card p-5 mb-5">
        <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-black text-xl">Daftar Produk</h2>
            <p className="text-sm">
              Total {products.length} produk • Aktif{" "}
              {products.filter((product) => product.is_active).length}
            </p>
          </div>

          <input
            className="input max-w-sm"
            placeholder="Cari produk..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        {loading && <p>Loading produk...</p>}

        {!loading && filteredProducts.length === 0 && (
          <div className="rounded-2xl border p-5 text-center">
            <p>Belum ada produk.</p>
            <button
              onClick={() => setForm(emptyForm)}
              className="btn btn-primary mt-3 inline-flex gap-2"
            >
              <Plus size={18} /> Tambah Produk
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div className="rounded-2xl border p-4" key={product.id}>
              <div className="h-36 rounded-2xl bg-coffee-100 mb-3 flex items-center justify-center overflow-hidden">
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

              <div className="flex justify-between gap-2">
                <div>
                  <h3 className="font-black text-lg">{product.name}</h3>
                  <p className="text-sm min-h-10">
                    {product.description || "-"}
                  </p>
                </div>

                <span
                  className={`pill ${product.is_active ? "payment-paid" : "payment-unpaid"}`}
                >
                  {product.is_active ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <div className="mt-3 flex justify-between font-black">
                <span>{rupiah(product.price)}</span>
                <span>#{product.sort_order}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="btn btn-soft text-sm flex gap-1"
                  onClick={() => editProduct(product)}
                >
                  <Edit3 size={15} /> Edit
                </button>

                <button
                  className="btn btn-soft text-sm"
                  onClick={() => toggleActive(product)}
                >
                  {product.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>

                <button
                  className="btn btn-soft text-sm flex gap-1"
                  onClick={() => removeProduct(product)}
                >
                  <Trash2 size={15} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
