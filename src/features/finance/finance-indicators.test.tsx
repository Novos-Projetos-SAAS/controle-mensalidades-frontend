import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Indicadores } from './finance-api';
import { FinanceIndicators, percentualSaldoVencido } from './finance-indicators';

const dados: Indicadores = {
  data_referencia: '2024-04-30',
  janela_vencimentos_fim: '2024-05-07',
  mensalidades_com_saldo: '2',
  saldo_total: '120.00',
  mensalidades_vencidas: '1',
  clientes_inadimplentes: '1',
  saldo_vencido: '50.00',
  mensalidades_proximos_7_dias: '1',
  saldo_proximos_7_dias: '70.00',
};

describe('indicadores de cobranças sem gateway', () => {
  it('exibe valores apurados e dispara filtros de vencimento', () => {
    const onOverdue = vi.fn();
    const onUpcoming = vi.fn();
    render(<FinanceIndicators data={dados} onOverdue={onOverdue} onUpcoming={onUpcoming} />);
    expect(screen.getByText('Cobranças e vencimentos')).toBeTruthy();
    expect(screen.getByText('41,7% do saldo a receber está vencido')).toBeTruthy();
    expect(screen.getByText(/A lista pode incluir mensalidades já pagas/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mensalidades vencidas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver intervalo de vencimentos' }));
    expect(onOverdue).toHaveBeenCalledOnce();
    expect(onUpcoming).toHaveBeenCalledOnce();
  });
  it('não divide por zero na ausência de pendências', () => {
    expect(percentualSaldoVencido({ ...dados, saldo_total: '0.00', saldo_vencido: '0.00' })).toBe('0,0%');
  });
});
