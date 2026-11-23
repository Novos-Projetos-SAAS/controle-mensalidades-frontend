import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClinicalDemo } from './clinical-demo';
import {
  estadoInicialDemo, finalizarEntrada, novaEntrada, revisarEntrada,
  type DadosClinicos, type EstadoDemo, type TipoRegistro,
} from './clinical-demo-domain';

let snapshot: { revisao: number; estado: EstadoDemo };

beforeEach(() => {
  snapshot = { revisao: 0, estado: estadoInicialDemo() };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') {
      return new Response(JSON.stringify(snapshot), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    const comando = JSON.parse(String(init.body)) as {
      acao: 'criar' | 'revisar' | 'finalizar' | 'reiniciar';
      revisao: number;
      pacienteId: string;
      registroId?: string;
      tipo: TipoRegistro;
      dados: DadosClinicos;
      justificativa: string;
      versaoEsperada: number;
    };
    if (snapshot.revisao !== comando.revisao) {
      return new Response(JSON.stringify({ mensagem: 'Dados alterados em outra aba.' }), {
        status: 409, headers: { 'content-type': 'application/json' },
      });
    }
    const id = comando.registroId || 'novo-' + (snapshot.revisao + 1);
    const agora = new Date().toISOString();
    if (comando.acao === 'criar') {
      snapshot.estado = novaEntrada(snapshot.estado, comando.pacienteId, comando.tipo, comando.dados as DadosClinicos, id, agora);
    } else if (comando.acao === 'revisar') {
      snapshot.estado = revisarEntrada(snapshot.estado, id, comando.dados as DadosClinicos, comando.justificativa, agora);
    } else if (comando.acao === 'finalizar') {
      snapshot.estado = finalizarEntrada(snapshot.estado, id, agora);
    } else {
      snapshot.estado = estadoInicialDemo();
    }
    snapshot.revisao++;
    return new Response(JSON.stringify({
      ...snapshot, registroId: comando.acao === 'reiniciar' ? null : id,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('tela de treinamento da fisioterapeuta', () => {
  it('exibe apenas paciente ficticio e histórico da sessão', async () => {
    render(<ClinicalDemo />);
    await screen.findByText('Prontuário do paciente');
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
    await screen.findByText('Prontuário do paciente');
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

  it('trocar paciente nao mistura historicos', async () => {
    render(<ClinicalDemo />);
    await screen.findByText('Prontuário do paciente');
    fireEvent.click(screen.getByRole('button', { name: /Paciente Exemplo C/ }));
    expect(screen.getByText('Este paciente fictício ainda não possui registros. Use uma das ações acima para começar.')).toBeTruthy();
    expect(screen.queryByText('Evolução e conduta da sessão · v1')).toBeNull();
  });
  it('continua mostrando o registro salvo após desmontar e recarregar a tela', async () => {
    const view = render(<ClinicalDemo />);
    await screen.findByText('Prontuário do paciente');
    fireEvent.click(screen.getByRole('button', { name: 'Novo laudo' }));
    for (const [label, value] of [
      ['Finalidade do laudo *', 'Laudo de treino'],
      ['Fundamentação e avaliação *', 'Fundamentação fictícia'],
      ['Achados funcionais *', 'Achados fictícios'],
      ['Diagnóstico fisioterapêutico *', 'Diagnóstico fictício'],
      ['Conclusão profissional *', 'Conclusão fictícia persistida'],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar laudo fictício' }));
    await screen.findByText('Laudo fisioterapêutico (simulado) · v1');

    view.unmount();
    render(<ClinicalDemo />);
    await screen.findByText('Laudo fisioterapêutico (simulado) · v1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Consultar registro' })[0]!);
    expect(screen.getByText('Conclusão fictícia persistida')).toBeTruthy();
  });

  it('imprime somente previa de laudo ficticio com identificacao e marca d agua', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<ClinicalDemo />);
    await screen.findByText('Prontuário do paciente');
    fireEvent.click(screen.getByRole('button', { name: 'Novo laudo' }));

    const campos = [
      ['Finalidade do laudo *', 'Avaliar ficticiamente'],
      ['Fundamentação e avaliação *', 'Fundamentação simulada'],
      ['Achados funcionais *', 'Achados apenas para teste'],
      ['Diagnóstico fisioterapêutico *', 'Diagnóstico fictício'],
      ['Conclusão profissional *', 'Conclusão sem valor clínico'],
    ] as const;
    for (const [label, value] of campos) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar laudo fictício' }));

    await waitFor(() => {
      expect(screen.getByText('Laudo fisioterapêutico (simulado) · v1')).toBeTruthy();
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Consultar registro' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir prévia do laudo fictício' }));
    expect(printSpy).toHaveBeenCalledOnce();

    const documento = document.getElementById('clinical-demo-print');
    expect(documento?.textContent).toContain('SIMULAÇÃO · SEM VALIDADE');
    expect(documento?.textContent).toContain('CREFITO FICTÍCIO');
    expect(documento?.textContent).toContain('Conclusão sem valor clínico');
    expect(documento?.textContent).toContain('NÃO É DOCUMENTO ASSINADO');
  });
});
