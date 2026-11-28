'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { queryError } from './whatsapp-display';
import type { WhatsappContext } from './whatsapp-api';

type Estado = {
  habilitado: boolean;
  status: 'DESABILITADO' | 'DESCONECTADO' | 'CONECTANDO' | 'QR_CODE' | 'CONECTADO' | 'ERRO';
  qr: string | null;
  salvo: boolean;
  ultimoTeste: string | null;
  destinatarioTeste: string | null;
  modo: 'DEMO' | 'ROTINA' | null;
  testado: boolean;
  rotinaAtiva: boolean;
};
const caminho = '/whatsapp/baileys';
const statusLabel: Record<Estado['status'], string> = {
  DESABILITADO: 'Não habilitado',
  DESCONECTADO: 'Desconectado',
  CONECTANDO: 'Conectando...',
  QR_CODE: 'Aguardando leitura do QR Code',
  CONECTADO: 'Conectado',
  ERRO: 'Falha na conexão',
};

export function WhatsappBaileys({ context }: { context: WhatsappContext }) {
  const [ocupado, setOcupado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [testado, setTestado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [falha, setFalha] = useState('');
  const query = useQuery({
    queryKey: ['whatsapp', context.organizacaoId, context.areaId, 'baileys-demo'],
    queryFn: ({ signal }) => api<Estado>(caminho + '/status', { signal, cache: 'no-store' }, context),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'CONECTANDO' || s === 'QR_CODE' || s === 'CONECTADO' ? 2500 : false;
    },
    refetchIntervalInBackground: false,
    retry: false,
    gcTime: 0,
  });
  const estado = query.data;
  const ativo = estado?.status === 'CONECTANDO' || estado?.status === 'QR_CODE' || estado?.status === 'CONECTADO';
  async function acao(operacao: 'conectar' | 'parar' | 'testar' | 'sessao') {
    setOcupado(true);
    setAviso('');
    setFalha('');
    try {
      if (operacao === 'testar') {
        setTestado(true);
        setConfirmado(false);
        await api(caminho + '/testar', {
          method: 'POST',
          body: JSON.stringify({ confirmado: true }),
        }, context);
        setAviso('Mensagem submetida. Confirme o recebimento no celular de teste.');
      } else {
        await api(caminho + '/' + operacao, {
          method: operacao === 'sessao' ? 'DELETE' : 'POST',
        }, context);
        if (operacao === 'conectar') { setTestado(false); setConfirmado(false); }
        if (operacao === 'sessao') setAviso('Sessão apagada. Remova também o aparelho conectado no WhatsApp.');
      }
    } catch (error) {
      setFalha(error instanceof Error ? queryError(error) : 'Não foi possível concluir a operação.');
    } finally {
      await query.refetch();
      setOcupado(false);
    }
  }
  return (
    <section className="surface space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Conectar por QR Code</h2>
          <p className="mt-1 text-sm text-slate-600">WhatsApp via Baileys · modo demonstração</p>
        </div>
        <span role="status" className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-900">
          {estado ? statusLabel[estado.status] : 'Consultando...'}
        </span>
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
        Integração extraoficial com risco de bloqueio. Use somente um número exclusivo de teste.
        As cobranças automáticas são limitadas ao destinatário de demonstração com consentimento.
      </p>
      {query.isError && <p role="alert" className="text-sm text-red-700">{queryError(query.error)}</p>}
      {estado && !estado.habilitado && <p className="text-sm text-slate-600">Demonstração não habilitada para esta área.</p>}
      {estado?.habilitado && (
        <>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-medium">{estado.salvo ? 'Sessão salva de forma criptografada' : 'Nenhuma sessão salva'}</p>
            <p className="mt-1 text-sm text-slate-600">A conexão de demonstração dura no máximo três minutos. O servidor pode hibernar normalmente.</p>
            {estado.status === 'QR_CODE' && estado.qr && (
              <div className="mt-4 flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={estado.qr} alt="QR Code de conexão do WhatsApp" width={280} height={280} className="max-w-full rounded-lg" />
                <p className="text-center text-sm text-slate-600">No WhatsApp: Aparelhos conectados → Conectar um aparelho. Não compartilhe este QR Code.</p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={ocupado || ativo} onClick={() => void acao('conectar')}>
                {estado.salvo ? 'Reconectar WhatsApp' : 'Conectar WhatsApp'}
              </Button>
              <Button variant="outline" disabled={ocupado || !ativo || estado.modo === 'ROTINA'} onClick={() => void acao('parar')}>Encerrar conexão</Button>
              <Button variant="outline" disabled={ocupado || ativo || !estado.salvo} onClick={() => {
                if (window.confirm('Apagar sessão salva? Remova o aparelho também no WhatsApp.')) void acao('sessao');
              }}>Apagar sessão</Button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 text-sm">
            <h3 className="font-semibold">Rotina de cobranças</h3>
            <p className="mt-2">{estado.rotinaAtiva ? 'Habilitada no backend (somente demonstração)' : 'Desabilitada'}</p>
            <p className="mt-1 text-slate-600">Janela de envio: 09h às 19h, horário de Brasília. Agendador externo previsto para 09h, 12h, 15h e 18h. Sem conexão contínua.</p>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">Mensagem de teste</h3>
            <p className="text-sm">Destinatário autorizado: {estado.destinatarioTeste ?? 'Não configurado'}</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} disabled={ocupado || testado || estado.testado || estado.modo !== 'DEMO'} />
              Confirmo que controlo o número destinatário e autorizo uma única mensagem de demonstração.
            </label>
            <Button disabled={ocupado || testado || estado.testado || estado.modo !== 'DEMO' || !confirmado || !estado.destinatarioTeste || estado.status !== 'CONECTADO'} onClick={() => void acao('testar')}>
              Enviar mensagem de teste
            </Button>
            {estado.ultimoTeste && <p className="text-sm text-slate-600">Último teste: {estado.ultimoTeste === 'SUBMETIDO' ? 'Submetido (entrega não confirmada)' : 'Resultado incerto — verifique o celular antes de repetir.'}</p>}
          </div>
        </>
      )}
      {aviso && <p role="status" className="text-sm text-teal-900">{aviso}</p>}
      {falha && <p role="alert" className="text-sm text-red-700">{falha}</p>}
      <Button variant="outline" disabled={ocupado || query.isFetching} onClick={() => void query.refetch()}>Atualizar status</Button>
    </section>
  );
}
