'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the clean page
    router.replace('/excel-import-clean');
  }, [router]);

  // Show a brief loading message while redirecting
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      color: '#1976d2'
    }}>
      <div>
        <h2>🔧 VIC CDM MERGE TOOL</h2>
        <p>Redirecting to the application...</p>
      </div>
    </div>
  );
}
