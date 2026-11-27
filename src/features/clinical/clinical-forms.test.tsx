import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { anamneseSchema, evolucaoSchema, laudoSchema, sessaoClinicaLegada } from './clinical-contracts';
import { AnamneseForm, EvolucaoForm, LaudoForm, ClinicalTimeline } from './clinical-forms';

afterEach(cleanup);

describe('rascunhos profissionais do prontuário', () => {
  it('exige histórico relevante, sem enviar dados ao servidor', async () => {
    const validated = vi.fn();
    render(<AnamneseForm onValidated={validated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Validar rascunho de anamnese' }));
    expect(await screen.findByText('Preencha a queixa principal.')).toBeTruthy();
    expect(validated).not.toHaveBeenCalled();
    expect(anamneseSchema.safeParse({
      queixa_principal: 'Queixa',
      historia_condicao_atual: 'História',
      limitacoes_funcionais: 'Limitações',
      objetivos_paciente: 'Objetivos',
      avaliacao_inicial: 'Avaliação',
    }).success).toBe(true);
  });

  it('obriga registrar o que foi trabalhado, resposta e evolução', async () => {
    const validated = vi.fn();
    render(<EvolucaoForm onValidated={validated} />);
    fireEvent.change(screen.getByLabelText('Data da sessão *'), { target: { value: '2026-11-21' } });
    fireEvent.change(screen.getByLabelText('Objetivo da sessão *'), { target: { value: 'Mobilidade' } });
    fireEvent.change(screen.getByLabelText('Resposta e tolerância do paciente *'), { target: { value: 'Tolerou' } });
    fireEvent.change(screen.getByLabelText('Evolução clínica observada *'), { target: { value: 'Evolução descrita pelo profissional' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar rascunho da evolução' }));
    expect(await screen.findByText('Preencha o que foi trabalhado na sessão.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('O que foi trabalhado na sessão *'), {
      target: { value: 'Exercícios terapêuticos e treino funcional' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar rascunho da evolução' }));
    await waitFor(() => expect(validated).toHaveBeenCalledOnce());
    expect(validated.mock.calls[0][0]).toMatchObject({
      procedimentos_realizados: 'Exercícios terapêuticos e treino funcional',
      evolucao_clinica: 'Evolução descrita pelo profissional',
    });
  });

  it('impede laudo vazio e mantém o caráter não assinado do rascunho', async () => {
    render(<LaudoForm onValidated={vi.fn()} />);
    expect(screen.getByText('Este formulário não emite documento assinado.', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Validar rascunho de laudo' }));
    expect(await screen.findByText('Preencha a finalidade do laudo.')).toBeTruthy();
    expect(laudoSchema.safeParse({ finalidade: '', conclusao: '' }).success).toBe(false);
  });

  it('ordena histórico e delega consulta sem colocar conteúdo clínico na lista', () => {
    const select = vi.fn();
    render(<ClinicalTimeline
      entries={[
        { id: 'a', data: '2026-10-05', profissional_nome: 'Profissional A', titulo: 'Avaliação', tipo: 'ANAMNESE' },
        { id: 'b', data: '2026-11-08', profissional_nome: 'Profissional A', titulo: 'Sessão', tipo: 'EVOLUCAO' },
      ]}
      onSelect={select}
    />);
    const buttons = screen.getAllByRole('button', { name: 'Consultar registro' });
    fireEvent.click(buttons[0]!);
    expect(select).toHaveBeenCalledWith('b');
  });

  it('não converte rascunho estruturado para o formato legado perdendo procedimentos', () => {
    const dados = evolucaoSchema.parse({
      data_sessao: '2026-11-21',
      objetivo_sessao: 'Mobilidade',
      procedimentos_realizados: 'Exercícios específicos',
      resposta_paciente: 'Sem intercorrências',
      evolucao_clinica: 'Resposta observada',
    });
    const resultado = sessaoClinicaLegada(dados);
    expect(resultado.evolucao).toBe('Resposta observada');
    expect(resultado.intervencoes_pendentes_de_modelagem.procedimentos_realizados).toBe('Exercícios específicos');
  });
});
