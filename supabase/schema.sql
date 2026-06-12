-- Jalankan file ini di Supabase SQL Editor.
create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price integer not null default 0,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  area_name text not null,
  note text,
  total_amount integer not null default 0,
  status text not null default 'new' check (status in ('new','processing','ready','done','cancelled')),
  distance_meter integer,
  payment_method text not null default 'qris' check (payment_method in ('qris','cash')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','waiting_verification','paid','rejected')),
  payment_reference text,
  payment_provider text,
  payment_provider_order_id text unique,
  payment_provider_transaction_id text,
  payment_qr_image_url text,
  payment_qr_string text,
  payment_response jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  qty integer not null default 1,
  price integer not null default 0,
  subtotal integer not null default 0,
  created_at timestamptz not null default now()
);


-- Aman dijalankan ulang untuk database lama yang belum memiliki kolom pembayaran.
alter table public.orders add column if not exists payment_method text not null default 'qris';
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists paid_at timestamptz;

alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_provider_order_id text;
alter table public.orders add column if not exists payment_provider_transaction_id text;
alter table public.orders add column if not exists payment_qr_image_url text;
alter table public.orders add column if not exists payment_qr_string text;
alter table public.orders add column if not exists payment_response jsonb;
create unique index if not exists orders_payment_provider_order_id_idx on public.orders(payment_provider_order_id) where payment_provider_order_id is not null;


do $$ begin
  alter table public.orders add constraint orders_payment_method_check check (payment_method in ('qris','cash'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.orders add constraint orders_payment_status_check check (payment_status in ('unpaid','waiting_verification','paid','rejected'));
exception when duplicate_object then null;
end $$;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (true);

drop policy if exists "products public insert" on public.products;
create policy "products public insert" on public.products for insert with check (true);

drop policy if exists "products public update" on public.products;
create policy "products public update" on public.products for update using (true) with check (true);

drop policy if exists "products public delete" on public.products;
create policy "products public delete" on public.products for delete using (true);

drop policy if exists "orders public insert" on public.orders;
create policy "orders public insert" on public.orders for insert with check (true);

drop policy if exists "orders public read" on public.orders;
create policy "orders public read" on public.orders for select using (true);

drop policy if exists "orders public update" on public.orders;
create policy "orders public update" on public.orders for update using (true) with check (true);

drop policy if exists "items public insert" on public.order_items;
create policy "items public insert" on public.order_items for insert with check (true);

drop policy if exists "items public read" on public.order_items;
create policy "items public read" on public.order_items for select using (true);

insert into public.products (name, description, price, sort_order) values
('Americano', 'Espresso dan air panas', 18000, 1),
('Cafe Latte', 'Espresso, susu steamed, foam tipis', 25000, 2),
('Cappuccino', 'Espresso, milk foam tebal', 24000, 3),
('Kopi Susu Gula Aren', 'Signature coffee milk', 22000, 4),
('Caramel Macchiato', 'Coffee milk dengan caramel', 30000, 5),
('Matcha Latte', 'Matcha premium dan susu', 28000, 6),
('Chocolate', 'Coklat creamy', 24000, 7),
('Croissant Butter', 'Pastry butter', 18000, 8)
on conflict do nothing;

-- Supabase Dashboard > Database > Replication:
-- Aktifkan realtime untuk tabel orders dan order_items.
