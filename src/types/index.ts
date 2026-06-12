export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export type CartItem = Product & { qty: number };
export type OrderStatus = 'new' | 'processing' | 'ready' | 'done' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'waiting_verification' | 'paid' | 'rejected';
export type PaymentMethod = 'qris' | 'cash';
export type PaymentProvider = 'midtrans' | 'manual' | null;

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  area_name: string;
  note: string | null;
  total_amount: number;
  status: OrderStatus;
  distance_meter: number | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  payment_provider: PaymentProvider;
  payment_provider_order_id: string | null;
  payment_provider_transaction_id: string | null;
  payment_qr_image_url: string | null;
  payment_qr_string: string | null;
  payment_response: unknown | null;
  paid_at: string | null;
  created_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  price: number;
  subtotal: number;
};
