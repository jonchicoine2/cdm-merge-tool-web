import { redirect } from 'next/navigation';

export default function Home() {
  // Server-side redirect - no client-side loading delay
  redirect('/excel-import-clean');
}
