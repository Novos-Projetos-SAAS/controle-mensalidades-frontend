'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/query-state';
import {
  financeApi, useFinanceQuery,
  type FinanceContext, type Mensalidade, type Pagamento,
} from '@/features/finance/finance-api';
import { financeErrorMessage, money } from '@/features/finance/finance-utils';
import { formatDate } from '@/lib/format';

const rotulos: Record<Mensalidade['status'], string> = {
  PENDENTE: 'Aguardando pagamento',
  PARCIAL: 'Parcialmente paga',
  VENCIDA: 'Vencida',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
};

const cores: Record<Mensalidade['status'], string> = {
  PENDENTE: 'bg-amber-50 text-amber-900',
  PARCIAL: 'bg-blue-50 text-blue-800',
  VENCIDA: 'bg-red-50 text-red-800',
  PAGA: 'bg-emerald-50 text-emerald-800',
  CANCELADA: 'bg-slate-100 text-slate-700',
};

function dataPagamento(valor: string): string {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return 'Data não disponível';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(data);
}

function Status({ status }: { status: Mensalidade['status'] }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cores[status]}`}>
    {rotulos[status]}
  </span>;
}

function ComprovanteInterno({
  mensalidade, pagamento, clienteNome,
}: {
  mensalidade: Mensalidade;
  pagamento: Pagamento;
  clienteNome: string;
}) {
  return (
    <article className="rounded-xl border border-teal-200 bg-teal-50/50 p-4"
      aria-label="Comprovante interno do recebimento">
      <h4 className="text-base font-semibold text-slate-900">Comprovante interno do recebimento</h4>
      <p className="mt-1 text-xs text-slate-600">
        Registro financeiro confirmado no sistema. Não substitui comprovante bancário ou
        documento emitido pela operadora do pagamento; não é documento fiscal.
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-600">Cliente</dt><dd className="font-medium">{clienteNome}</dd></div>
        <div><dt className="text-slate-600">Mensalidade</dt>
          <dd className="font-medium">{mensalidade.competencia.slice(0, 7)}</dd></div>
        <div><dt className="text-slate-600">Valor recebido</dt>
          <dd className="font-semibold">{money(pagamento.valor)}</dd></div>
        <div><dt className="text-slate-600">Data do pagamento (Brasília)</dt>
          <dd className="font-medium">{dataPagamento(pagamento.pago_em)}</dd></div>
        <div><dt className="text-slate-600">Forma de pagamento</dt>
          <dd className="font-medium">{pagamento.forma_pagamento}</dd></div>
        <div><dt className="text-slate-600">Identificador do recebimento</dt>
          <dd className="break-all font-mono text-xs">{pagamento.id}</dd></div>
      </dl>
    </article>
  );
}

/**
 * Área financeira exclusivamente administrativa. Não lê dados de outras áreas:
 * listagem e detalhes são obtidos via endpoints financeiros com escopo autenticado.
 * Não inventa comprovante quando não existe pagamento registrado.
 */
export function ClienteMensalidades({
  clienteId, clienteNome, contexto,
}: {
  clienteId: string;
  clienteNome: string;
  contexto: FinanceContext;
}) {
  const [pagina, setPagina] = useState(1);
  const [status, setStatus] = useState<Mensalidade['status'] | ''>('');
  const [mensalidadeId, setMensalidadeId] = useState<string | null>(null);
  const [pagamentoId, setPagamentoId] = useState<string | null>(null);

  const mensalidades = useFinanceQuery(
    contexto, ['cliente', clienteId, 'mensalidades', pagina, status],
    (signal) => financeApi.mensalidades(contexto, {
      page: pagina, clienteId, ...(status ? { status } : {}),
    }, signal),
    !!clienteId,
  );
  const detalhe = useFinanceQuery(
    contexto, ['cliente', clienteId, 'mensalidade', mensalidadeId],
    (signal) => financeApi.mensalidade(contexto, mensalidadeId!, signal),
    !!clienteId && !!mensalidadeId,
  );
  const registro = detalhe.data?.cliente_id === clienteId ? detalhe.data : null;
  const pagamento = registro?.pagamentos?.find((item) => item.id === pagamentoId);

  function abrir(mensalidade: Mensalidade) {
    setPagamentoId(null);
    setMensalidadeId(mensalidade.id);
  }

  return (
    <section aria-label="Mensalidades do cliente" className="mt-5 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Mensalidades e pagamentos</h3>
          <p className="mt-1 text-sm text-slate-600">
            Cobranças geradas, valores pagos e recebimentos registrados nesta área.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void mensalidades.refetch()}
          disabled={mensalidades.isFetching}>Atualizar</Button>
      </div>
      <label className="block sm:max-w-xs">
        <span className="field-label">Situação das mensalidades</span>
        <select className="select-field" value={status} onChange={(event) => {
          setStatus(event.target.value as Mensalidade['status'] | '');
          setPagina(1);
          setMensalidadeId(null);
          setPagamentoId(null);
        }}>
          <option value="">Todas as mensalidades</option>
          <option value="PAGA">Pagas</option>
          <option value="PENDENTE">Aguardando pagamento</option>
          <option value="PARCIAL">Parcialmente pagas</option>
          <option value="VENCIDA">Vencidas</option>
          <option value="CANCELADA">Canceladas</option>
        </select>
      </label>

      {mensalidades.isPending ? <LoadingState rows={3} /> : mensalidades.isError ? (
        <ErrorState
          message={financeErrorMessage(mensalidades.error,
            'Não foi possível consultar as mensalidades deste cliente.')}
          retry={() => mensalidades.refetch()}
        />
      ) : !mensalidades.data?.items.length ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          {status ? 'Nenhuma mensalidade com essa situação.' :
            'Ainda não há mensalidades geradas para este cliente nesta área.'}
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {mensalidades.data.pagination.total} mensalidade(s) encontrada(s) ·
            página {mensalidades.data.pagination.page} de {mensalidades.data.pagination.pages}
          </p>
          <ol className="space-y-3">
            {mensalidades.data.items.map((mensalidade) => (
              <li key={mensalidade.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="font-semibold text-slate-900">
                      Competência {mensalidade.competencia.slice(0, 7)}
                    </p>
                    <Status status={mensalidade.status} />
                    <p className="text-xs text-slate-600">
                      Vencimento: {formatDate(mensalidade.vencimento_em)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{money(mensalidade.valor_final)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Pago: {money(mensalidade.valor_pago)}
                    </p>
                    <p className="text-xs text-slate-600">Saldo: {money(mensalidade.saldo)}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-3"
                  onClick={() => abrir(mensalidade)}>
                  {mensalidade.status === 'PAGA' || Number(mensalidade.valor_pago) > 0
                    ? 'Ver pagamentos e comprovantes' : 'Ver detalhes'}
                </Button>
              </li>
            ))}
          </ol>
          {mensalidades.data.pagination.pages > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label="Páginas das mensalidades do cliente">
              <Button variant="outline" size="sm" disabled={pagina <= 1 || mensalidades.isFetching}
                onClick={() => { setPagina((atual) => atual - 1); setMensalidadeId(null); }}>
                Anterior
              </Button>
              <span className="text-xs text-slate-600">
                Página {pagina} de {mensalidades.data.pagination.pages}
              </span>
              <Button variant="outline" size="sm"
                disabled={pagina >= mensalidades.data.pagination.pages || mensalidades.isFetching}
                onClick={() => { setPagina((atual) => atual + 1); setMensalidadeId(null); }}>
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}

      {mensalidadeId && (
        <section className="space-y-3 rounded-xl border-2 border-teal-200 p-4"
          aria-label="Detalhes dos pagamentos da mensalidade">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold text-slate-900">Pagamentos da mensalidade</h4>
            <Button variant="ghost" size="sm" onClick={() => {
              setMensalidadeId(null); setPagamentoId(null);
            }}>Fechar</Button>
          </div>
          {detalhe.isPending ? <LoadingState rows={2} /> : detalhe.isError ? (
            <ErrorState message={financeErrorMessage(detalhe.error,
              'Não foi possível consultar os recebimentos desta mensalidade.')}
              retry={() => detalhe.refetch()} />
          ) : !registro ? (
            <p role="alert" className="text-sm text-red-800">
              Mensalidade não disponível para este cliente.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Competência {registro.competencia.slice(0, 7)} ·
                valor {money(registro.valor_final)} · saldo {money(registro.saldo)}
              </p>
              {!registro.pagamentos?.length ? (
                <p className="text-sm text-slate-600">
                  Nenhum pagamento registrado para esta mensalidade.
                  Não há comprovante interno disponível.
                </p>
              ) : (
                <ul className="space-y-2">
                  {registro.pagamentos.map((item) => (
                    <li key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <span>{formatDate(item.pago_em)} · {item.forma_pagamento} · {money(item.valor)}</span>
                      <Button variant="outline" size="sm"
                        onClick={() => setPagamentoId(item.id)}>
                        Ver comprovante
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {pagamento && (
                <ComprovanteInterno
                  mensalidade={registro} pagamento={pagamento} clienteNome={clienteNome}
                />
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
