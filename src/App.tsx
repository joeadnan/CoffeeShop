import { BaristaDashboard } from './pages/BaristaDashboard';
import { OrderPage } from './pages/OrderPage';
import { PaymentPage } from './pages/PaymentPage';
import { QRPage } from './pages/QRPage';
import { ProductAdminPage } from './pages/ProductAdminPage';

export default function App(){
  const path = window.location.pathname;
  if(path.startsWith('/barista')) return <BaristaDashboard />;
  if(path.startsWith('/products')) return <ProductAdminPage />;
  if(path.startsWith('/payment/')) return <PaymentPage />;
  if(path.startsWith('/qr')) return <QRPage />;
  return <OrderPage />;
}
