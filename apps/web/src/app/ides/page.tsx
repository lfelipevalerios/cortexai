'use client';

import { IdesView } from '@/components/ides/IdesView';
import { useOptionalWs } from '@/lib/store';

export default function IdesPage() {
  const ws = useOptionalWs();
  if (!ws) return null;
  return <IdesView />;
}
