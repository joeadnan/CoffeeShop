import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type OrderItem = {
  id: string;
  product_name: string;
  qty: number;
  price: number;
  subtotal: number;
};

type OrderWithItems = {
  id: string;
  order_number: string;
  customer_name: string;
  area_name: string;
  total_amount: number;
  payment_provider_order_id: string | null;
  order_items?: OrderItem[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getMidtransBaseUrl(isProduction: boolean) {
  return isProduction ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2';
}

function getActionUrl(actions: Array<{ name?: string; url?: string }> | undefined, names: string[]) {
  return actions?.find((action) => action.name && names.includes(action.name))?.url ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, message: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    const isProduction = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true';
    const notificationUrl = Deno.env.get('MIDTRANS_NOTIFICATION_URL');
    const qrisAcquirer = Deno.env.get('MIDTRANS_QRIS_ACQUIRER') || 'gopay';

    if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset.');
    if (!midtransServerKey) throw new Error('MIDTRANS_SERVER_KEY belum diset.');

    const { order_id } = await req.json();
    if (!order_id) return json({ success: false, message: 'order_id wajib diisi.' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order_id)
      .single<OrderWithItems>();

    if (orderError || !order) throw new Error(orderError?.message || 'Order tidak ditemukan.');

    if (order.payment_provider_order_id) {
      return json({
        success: true,
        message: 'QRIS sudah pernah dibuat.',
      });
    }

    const providerOrderId = `${order.order_number}-${order.id.slice(0, 8)}`;
    const itemDetails = (order.order_items || []).map((item) => ({
      id: item.id,
      price: Number(item.price),
      quantity: Number(item.qty),
      name: String(item.product_name).slice(0, 50),
    }));

    const grossFromItems = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const grossAmount = Number(order.total_amount || grossFromItems);

    const payload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: providerOrderId,
        gross_amount: grossAmount,
      },
      qris: {
        acquirer: qrisAcquirer,
      },
      customer_details: {
        first_name: order.customer_name,
      },
      item_details: itemDetails.length > 0 ? itemDetails : undefined,
    };

    const headers: Record<string, string> = {
      Authorization: `Basic ${btoa(`${midtransServerKey}:`)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (notificationUrl) {
      headers['X-Override-Notification'] = notificationUrl;
    }

    const midtransResponse = await fetch(`${getMidtransBaseUrl(isProduction)}/charge`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const result = await midtransResponse.json();

    if (!midtransResponse.ok) {
      throw new Error(result?.status_message || result?.message || 'Midtrans gagal membuat QRIS.');
    }

    const qrImageUrl = getActionUrl(result.actions, ['generate-qr-code', 'generate_qr_code']);
    const qrString = getActionUrl(result.actions, ['qr-code-string', 'qr_code_string']);

    const { error: updateError } = await admin
      .from('orders')
      .update({
        payment_provider: 'midtrans',
        payment_provider_order_id: providerOrderId,
        payment_provider_transaction_id: result.transaction_id ?? null,
        payment_status: 'unpaid',
        payment_reference: providerOrderId,
        payment_qr_image_url: qrImageUrl,
        payment_qr_string: qrString,
        payment_response: result,
      })
      .eq('id', order.id);

    if (updateError) throw new Error(updateError.message);

    return json({
      success: true,
      qr_string: qrString,
      qr_image_url: qrImageUrl,
      transaction_id: result.transaction_id ?? null,
      transaction_status: result.transaction_status ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
    return json({ success: false, message }, 400);
  }
});
