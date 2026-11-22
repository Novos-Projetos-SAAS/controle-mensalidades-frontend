import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import type { Indicadores } from './finance-api';
import { money } from './finance-utils';

export function percentualSaldoVencido(indicadores: Indicadores): string {
  const total = Number(indicadores.saldo_total);
  const vencido = Number(indicadores.saldo_vencido);
  if (!Number.isFinite(total) || !Number.isFinite(vencido) || total <= 0) return '0,0%';
  const percentual = Math.min(100, Math.max(0, (vencido / total) * 100));
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(percentual) + '%';
}

export function FinanceIndicators({
  data,
  onOverdue,
  onUpcoming,
}: {
  data: Indicadores;
  onOverdue: () => void;
  onUpcoming: () => void;
}) {
  return (
    <section aria-label="Cobranças e vencimentos" className="mt-6">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">Cobranças e vencimentos</h2>
        <p className="text-xs text-slate-600">
          Posição em {formatDate(data.data_referencia)} · saldos não quitados, sem contas canceladas
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="surface min-w-0 p-5">
          <p className="text-sm text-slate-600">Saldo vencido</p>
          <strong className="display mt-3 block text-3xl text-red-800">
            {money(data.saldo_vencido)}
          </strong>
          <p className="mt-2 text-xs text-slate-600">
            {data.mensalidades_vencidas} mensalidade(s) · {data.clientes_inadimplentes} cliente(s)
          </p>
          <Button variant="outline" className="mt-4 w-full" onClick={onOverdue}>
            Ver mensalidades vencidas
          </Button>
        </article>
        <article className="surface min-w-0 p-5">
          <p className="text-sm text-slate-600">Vencem nos próximos 7 dias</p>
          <strong className="display mt-3 block text-3xl text-amber-800">
            {money(data.saldo_proximos_7_dias)}
          </strong>
          <p className="mt-2 text-xs text-slate-600">
            {data.mensalidades_proximos_7_dias} mensalidade(s) com saldo
          </p>
          <Button variant="outline" className="mt-4 w-full" onClick={onUpcoming}>
            Ver intervalo de vencimentos
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            A lista pode incluir mensalidades já pagas; filtre a situação se necessário.
          </p>
        </article>
        <article className="surface min-w-0 p-5">
          <p className="text-sm text-slate-600">Carteira total a receber</p>
          <strong className="display mt-3 block text-3xl text-teal-800">
            {money(data.saldo_total)}
          </strong>
          <p className="mt-2 text-xs text-slate-600">
            {data.mensalidades_com_saldo} mensalidade(s) em aberto, incluindo vencidas
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            {percentualSaldoVencido(data)} do saldo a receber está vencido
          </p>
        </article>
      </div>
    </section>
  );
}
