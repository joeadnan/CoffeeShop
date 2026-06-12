import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sha512(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mapPaymentStatus(transactionStatus: string, fraudStatus?: string) {
  if (transactionStatus === 'settlement') return 'paid';
  if (transactionStatus === 'capture') return fraudStatus === 'accept' ? 'paid' : 'unpaid';
  if (transactionStatus === 'pending') return 'unpaid';
  if (['deny', 'cancel', 'expire', 'failure'].includes(transactionStatus)) return 'rejected';
  return 'unpaid';
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ success: false, message: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY');

    if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset.');
    if (!midtransServerKey) throw new Error('MIDTRANS_SERVER_KEY belum diset.');

    const body = await req.json();
    const orderId = String(body.order_id || '');
    const statusCode = String(body.status_code || '');
    const grossAmount = String(body.gross_amount || '');
    const signatureKey = String(body.signature_key || '');

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return json({ success: false, message: 'Payload Midtrans tidak lengkap.' }, 400);
    }

    const expectedSignature = await sha512(`${orderId}${statusCode}${grossAmount}${midtransServerKey}`);
    if (expectedSignature !== signatureKey) {
      return json({ success: false, message: 'Invalid signature.' }, 401);
    }

    const transactionStatus = String(body.transaction_status || '');
    const fraudStatus = body.fraud_status ? String(body.fraud_status) : undefined;
    const paymentStatus = mapPaymentStatus(transactionStatus, fraudStatus);

    const patch: Record<string, unknown> = {
      payment_status: paymentStatus,
      payment_provider: 'midtrans',
      payment_provider_transaction_id: body.transaction_id ?? null,
      payment_response: body,
    };

    if (paymentStatus === 'paid') {
      patch.paid_at = new Date().toISOString();
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await admin
      .from('orders')
      .update(patch)
      .eq('payment_provider_order_id', orderId);

    if (error) throw new Error(error.message);

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
    return json({ success: false, message }, 400);
  }
});
