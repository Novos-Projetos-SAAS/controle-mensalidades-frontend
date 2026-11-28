'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { platformPaymentUrl } from './payment-utils';

export function CopyPaymentLinkButton({
  path,
  label = 'Copiar link',
  className,
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    setError(false);
    setCopied(false);
    try {
      const url = platformPaymentUrl(path, window.location.origin);
      if (!url) throw new Error('Link indisponível');
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="min-w-0">
      <Button type="button" variant="secondary" className={className} onClick={copy}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copied ? 'Link copiado' : label}
      </Button>
      {copied && <p role="status" className="mt-1 text-xs text-teal-800">Link copiado para compartilhar.</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-800">
          Não foi possível copiar. Abra o link e copie o endereço.
        </p>
      )}
    </div>
  );
}
