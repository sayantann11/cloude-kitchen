import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { CheckoutPage } from './pages/customer/Checkout';
import { MenuPage } from './pages/customer/Menu';
import { OrdersPage } from './pages/customer/Orders';
import { TrackPage } from './pages/customer/Track';
import { match, path } from './state/router';
import { Skeleton, Toast } from './ui/kit';

/** The rider screen is a separate chunk. The admin portal is a separate page (admin.html): customers never download it. */
function lazy<P>(load: () => Promise<ComponentType<P>>) {
  let C: ComponentType<P> | null = null;
  let p: Promise<void> | null = null;
  return (props: P) => {
    const [, force] = useState(0);
    useEffect(() => {
      if (C) return;
      p = p ?? load().then(c => { C = c; });
      p.then(() => force(n => n + 1)).catch(() => force(n => n + 1));
    }, []);
    return C ? <C {...(props as P & object)} /> : <div class="wrap" style={{ paddingTop: '40px' }}><Skeleton /></div>;
  };
}
const Rider = lazy<{ id: string }>(() => import('./pages/rider/RiderTrip').then(m => m.RiderTrip));

export function App() {
  const p = path.value;
  let page;
  let m: Record<string, string> | null;
  if (p.split('?')[0] === '/' || p.startsWith('/?')) page = <MenuPage />;
  else if (match('/checkout', p)) page = <CheckoutPage />;
  else if (match('/orders', p)) page = <OrdersPage />;
  else if ((m = match('/order/:id', p))) page = <TrackPage key={m.id} id={m.id} />;
  else if ((m = match('/rider/:id', p))) page = <Rider id={m.id} />;
  else page = <NotFound />;
  return <>{page}<Toast /></>;
}

function NotFound() {
  return <main class="wrap" style={{ paddingTop: '60px' }}><div class="empty"><b>Page not found</b><a class="btn primary" href="/">Go to menu</a></div></main>;
}
