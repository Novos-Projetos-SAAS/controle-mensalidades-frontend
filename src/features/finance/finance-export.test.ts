import { describe, expect, it } from 'vitest';
import type { Mensalidade } from './finance-api';
import { csvCell, financeCsv } from './finance-export';

const invoice: Mensalidade = {
  id: 'm1', conta_receber_id: 'cr1', assinatura_id: 'a1', cliente_id: 'c1',
  cliente_nome: 'Cliente, Exemplo', competencia: '2026-11-01', vencimento_em: '2026-11-15',
  status: 'VENCIDA', status_conta: 'PENDENTE', valor_base: '100.00', desconto_recorrente: '0.00',
  ajuste_competencia: '0.00', valor_final: '100.00', valor_pago: '30.00', saldo: '70.00',
};

describe('exportação financeira CSV apenas da página carregada', () => {
  it('exporta status, saldo e colunas explícitas sem CPF ou prontuário', () => {
    const csv = financeCsv([invoice]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Cliente";"Competência";"Vencimento"');
    expect(csv).toContain('"Cliente, Exemplo";"2026-11";"2026-11-15";"VENCIDA";"100.00";"30.00";"70.00"');
    expect(csv).not.toContain('cpf');
    expect(csv).not.toContain('evolucao');
  });
  it('impede execução de fórmulas de planilha em nomes maliciosos', () => {
    const csv = financeCsv([{ ...invoice, cliente_nome: '  =HYPERLINK("https://example.invalid")' }]);
    expect(csv).toContain('"\'  =HYPERLINK(""https://example.invalid"")"');
    expect(csvCell('+SUM(1,2)')).toBe('"\'+SUM(1,2)"');
    expect(csvCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    expect(csvCell('-1+2')).toBe('"\'-1+2"');
  });
  it('preserva delimitadores e aspas dentro dos campos', () => {
    expect(csvCell('Ana; "Bia"')).toBe('"Ana; ""Bia"""');
  });
  it('não tenta buscar registros de outras páginas', () => {
    const csv = financeCsv([invoice]);
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
