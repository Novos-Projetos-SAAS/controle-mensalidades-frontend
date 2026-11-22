import type { Mensalidade } from './finance-api';

// Formula injection protection: client names are user-controlled data.
// Wrap every field and prefix dangerous spreadsheet formulas, even after whitespace.
export function csvCell(value: string | number | null | undefined): string {
  const raw = String(value ?? '').replace(/\u0000/g, '');
  const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

/**
 * Exporta somente as mensalidades recebidas na página atual da API.
 * Não busca outras páginas, não lê outros tenants e não exporta dados clínicos.
 */
export function financeCsv(items: readonly Mensalidade[]): string {
  const lines = [
    ['Cliente', 'Competência', 'Vencimento', 'Situação', 'Valor total (R$)', 'Pago (R$)', 'Saldo (R$)'],
    ...items.map((item) => [
      item.cliente_nome,
      item.competencia.slice(0, 7),
      item.vencimento_em.slice(0, 10),
      item.status,
      item.valor_final,
      item.valor_pago,
      item.saldo,
    ]),
  ];
  return '\uFEFF' + lines.map((line) => line.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function downloadFinanceCsv(items: readonly Mensalidade[]): void {
  if (!items.length) return;
  const blob = new Blob([financeCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mensalidades-pagina-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
