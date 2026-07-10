import { redirect } from 'next/navigation';

export default function RootPage(): never {
  // The authenticated shell guards itself; unauthenticated users bounce to /login.
  redirect('/dashboard');
}
