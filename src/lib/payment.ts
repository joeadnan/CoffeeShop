import { supabase } from './supabase';

export type CreateQrisResponse = {
  success: boolean;
  qr_string?: string | null;
  qr_image_url?: string | null;
  transaction_id?: string | null;
  transaction_status?: string | null;
  message?: string;
};

export async function createMidtransQris(orderId: string): Promise<CreateQrisResponse> {
  const { data, error } = await supabase.functions.invoke<CreateQrisResponse>('midtrans-create-qris', {
    body: { order_id: orderId },
  });

  if (error) {
    throw new Error(error.message || 'Gagal membuat QRIS Midtrans.');
  }

  if (!data?.success) {
    throw new Error(data?.message || 'Gagal membuat QRIS Midtrans.');
  }

  return data;
}
