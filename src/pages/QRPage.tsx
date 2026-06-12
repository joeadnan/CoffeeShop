import { QRCodeCanvas } from 'qrcode.react';
import { config } from '../lib/config';
export function QRPage(){
  const url = `${window.location.origin}/`;
  return <div className="safe max-w-xl text-center"><div className="card p-8 mt-10"><h1 className="text-3xl font-black">QR Order {config.storeName}</h1><p className="my-3">Print QR ini dan letakkan di meja/kasir. Customer scan untuk order.</p><div className="inline-block bg-white p-5 rounded-2xl border"><QRCodeCanvas value={url} size={260}/></div><p className="mt-4 break-all font-semibold">{url}</p><div className="mt-5 flex justify-center gap-2"><button className="btn btn-primary" onClick={()=>window.print()}>Print QR</button><a className="btn btn-soft" href="/barista">Dashboard</a></div></div></div>
}
