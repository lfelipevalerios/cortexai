'use client';

import { AmbientesView } from '@/components/ambientes/AmbientesView';
import { useOptionalWs } from '@/lib/store';

export default function AmbientesPage() {
  const ws = useOptionalWs();
  if (!ws) return null;
  return <AmbientesView />;
}
