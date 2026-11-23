import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClinicalDemo } from './clinical-demo';

afterEach(cleanup);

describe('tela de treinamento da fisioterapeuta', () => {
  it('exibe apenas paciente ficticio e histórico da sessão', async () => {
    render(<ClinicalDemo />);
    expect(screen.getByText('Prontuário do paciente')).toBeTruthy();
    expect(screen.getByText('SIMULAÇÃO — não inserir dados de pacientes reais')).toBeTruthy();
    expect(screen.getAllByText('Paciente Exemplo A').length).toBeGreaterThan(0);
    expect(screen.getByText('Anamnese e avaliação inicial · v1')).toBeTruthy();
    expect(screen.getByText('Evolução e conduta da sessão · v1')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Consultar registro' })[0]!);
    expect(screen.getByText('Treino de marcha, mobilidade e exercícios funcionais (dados fictícios).')).toBeTruthy();
  });

  it('preserva versão anterior depois de corrigir registro fictício', async () => {
    render(<ClinicalDemo />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Consultar registro' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir registro' }));
    fireEvent.change(screen.getByLabelText('Motivo da revisão'), {
      target: { value: 'Corrigir exemplo de evolução' },
    });
    fireEvent.change(screen.getByLabelText('O que foi trabalhado na sessão *'), {
      target: { value: 'Treino funcional alterado na simulação' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar evolução fictícia' }));
    await waitFor(() => {
      expect(screen.getByText('Evolução e conduta da sessão · v2')).toBeTruthy();
    });
    expect(screen.getByText('Treino funcional alterado na simulação')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Versão 1' }));
    expect(screen.getByText('Treino de marcha, mobilidade e exercícios funcionais (dados fictícios).')).toBeTruthy();
  });

  it('trocar paciente nao mistura historicos', () => {
    render(<ClinicalDemo />);
    fireEvent.click(screen.getByRole('button', { name: /Paciente Exemplo C/ }));
    expect(screen.getByText('Este paciente fictício ainda não possui registros. Use uma das ações acima para começar.')).toBeTruthy();
    expect(screen.queryByText('Evolução e conduta da sessão · v1')).toBeNull();
  });
});
