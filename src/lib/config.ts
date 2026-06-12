export const config = {
  storeName: import.meta.env.VITE_STORE_NAME || "Kopi Radius",
  storeLat: Number(import.meta.env.VITE_STORE_LAT || -6.2),
  storeLng: Number(import.meta.env.VITE_STORE_LNG || 106.816666),
  accessRadiusMeter: Number(import.meta.env.VITE_ACCESS_RADIUS_METER || 150),
  adminPin: import.meta.env.VITE_ADMIN_PIN || "123456",
  paymentQrValue: import.meta.env.VITE_PAYMENT_QR_VALUE || "",
  paymentQrImageUrl: import.meta.env.VITE_PAYMENT_QR_IMAGE_URL || "",
  paymentAccountName:
    import.meta.env.VITE_PAYMENT_ACCOUNT_NAME || "Kopi Radius",
  paymentInstruction:
    import.meta.env.VITE_PAYMENT_INSTRUCTION ||
    "Scan QRIS, bayar sesuai total, lalu tekan tombol Saya sudah bayar.",
  developmentMode: true,
};
