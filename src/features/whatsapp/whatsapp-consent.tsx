'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ApiError, type Cliente } from '@/lib/api';
import { saveConsent } from './whatsapp-api';
import { displayDate } from './whatsapp-display';

export function WhatsappConsent({
  client,
  orgId,
  areaId,
}: {
  client: Cliente;
  orgId: string;
  areaId: string;
}) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const accepted = client.aceite_whatsapp;
  const date = accepted ? client.aceite_whatsapp_em : client.opt_out_whatsapp_em;
  const origin = accepted ? client.origem_aceite_whatsapp : client.origem_opt_out_whatsapp;
  const key = ['clientes', 'detail', orgId, areaId, client.id];

  async function submit() {
    if (confirm === null || pending) return;
    setPending(true);
    setError('');
    try {
      const result = await saveConsent(orgId, client.id, confirm);
      setConfirm(null);
      setNotice(result.aceite_whatsapp ? 'Consentimento registrado.' : 'Consentimento revogado.');
      queryClient.setQueryData<Cliente>(key, (previous) => previous && { ...previous, ...result });
      void queryClient.invalidateQueries({ queryKey: ['clientes', orgId] });
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          queryKey[0] === 'whatsapp' && queryKey[1] === orgId && queryKey[3] === 'tarefas',
      });
    } catch (error) {
      setError(
        error instanceof ApiError ? error.message : 'Não foi possível atualizar o consentimento.',
      );
      if (error instanceof ApiError && error.status === 409) {
        setConfirm(null);
        void queryClient.invalidateQueries({ queryKey: key, exact: true });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Consentimento de WhatsApp"
      className="mt-5 space-y-2 rounded-xl border border-slate-200 p-4 text-sm"
    >
      <h3 className="font-semibold">
        WhatsApp:{' '}
        {accepted === undefined ? 'Não informado' : accepted ? 'Autorizado' : 'Não autorizado'}
      </h3>
      {date && (
        <p className="break-words text-slate-600">
          {accepted ? 'Aceite' : 'Revogação'} em {displayDate(date)}
          {origin ? ` · ${origin}` : ''}
        </p>
      )}
      {notice && (
        <p role="status" className="text-teal-900">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {confirm !== null ? (
        <div className="space-y-3">
          <p>
            {confirm
              ? 'Confirme que o cliente autorizou receber mensagens por WhatsApp.'
              : 'Revogar o consentimento cancela as tarefas de WhatsApp pendentes deste cliente.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={submit} disabled={pending}>
              {pending ? 'Salvando...' : confirm ? 'Confirmar aceite' : 'Confirmar revogação'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm(null)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        accepted !== undefined && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNotice('');
              setError('');
              setConfirm(!accepted);
            }}
          >
            {accepted ? 'Revogar consentimento' : 'Registrar consentimento'}
          </Button>
        )
      )}
    </section>
  );
}
