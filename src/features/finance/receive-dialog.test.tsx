import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api';
import { financeApi, useFinanceQuery, type Mensalidade } from './finance-api';
import { ReceiveDialog } from './receive-dialog';
import { useSession } from '@/features/auth/session';

vi.mock('./finance-api', () => ({
  financeApi: { mensalidade: vi.fn(), receber: vi.fn() },
  useFinanceQuery: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/auth/session', () => ({ useSession: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(useSession).mockReturnValue({
    session: {
      usuario: { id: 'user-test', nome: 'Usuário Teste', email: 'teste@example.com' },
      organizacoes: [{ id: 'org-test', nome: 'Organização Teste', perfil: 'ADMIN' }],
    },
  } as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const receiptContext = { organizacaoId: 'org-test', areaId: 'area-test' };
const recoveryScope = JSON.stringify(['user-test', 'org-test', 'area-test', 'reload-invoice']);
const recoveryKey = `financeiro:recebimento:v1:${recoveryScope}`;
const recoveredAttempt = {
  key: 'df0767a4-a593-4508-824e-3fe980319d27',
  payload: { valor: '20.00', forma_pagamento: 'PIX', pago_em: '2026-11-10T12:00:17.123Z' },
  before: ['payment-before'],
};
const recoveryInvoice = {
  id: 'reload-invoice',
  conta_receber_id: 'account-reload',
  assinatura_id: 'subscription-reload',
  cliente_id: 'client-reload',
  cliente_nome: 'Cliente Teste',
  competencia: '2026-11-01',
  valor_base: '50.00',
  desconto_recorrente: '0.00',
  ajuste_competencia: '0.00',
  valor_final: '50.00',
  vencimento_em: '2026-11-10',
  status_conta: 'PENDENTE',
  valor_pago: '0.00',
  saldo: '50.00',
  status: 'PENDENTE',
  pagamentos: [{ id: 'payment-before' }],
} as Mensalidade;

function setupRecoveryInvoice(invoice = recoveryInvoice) {
  vi.mocked(useFinanceQuery).mockReturnValue({
    data: invoice,
    isPending: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({ data: invoice }),
  } as never);
  vi.mocked(financeApi.mensalidade).mockResolvedValue(invoice);
}

function restoreAttempt(overrides: Record<string, unknown> = {}) {
  sessionStorage.setItem(
    recoveryKey,
    JSON.stringify({ version: 1, scope: recoveryScope, attempt: recoveredAttempt, ...overrides }),
  );
}

function renderRecoveryDialog(callbacks: { onSaved?: () => void; onClose?: () => void } = {}) {
  return render(
    <ReceiveDialog
      context={receiptContext}
      id="reload-invoice"
      onClose={callbacks.onClose ?? vi.fn()}
      onSaved={callbacks.onSaved ?? vi.fn()}
    />,
  );
}

async function submitReceipt() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Valor a receber (R$) *' }), {
    target: { value: '20,00' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Forma de pagamento *' }), {
    target: { value: 'PIX' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
}

describe('recuperação segura do recebimento', () => {
  it('persiste a intenção antes do POST sem dados de identificação do cliente', async () => {
    setupRecoveryInvoice();
    let persistedBeforePost: unknown;
    vi.mocked(financeApi.receber).mockImplementationOnce(async () => {
      persistedBeforePost = JSON.parse(sessionStorage.getItem(recoveryKey) ?? 'null');
      throw new ApiError('Tempo esgotado', 0);
    });
    renderRecoveryDialog();
    await submitReceipt();
    await screen.findByRole('button', { name: 'Conferir recebimento' });
    expect(persistedBeforePost).toEqual({
      version: 1,
      scope: recoveryScope,
      attempt: {
        key: expect.any(String),
        payload: { valor: '20.00', forma_pagamento: 'PIX', pago_em: expect.any(String) },
        before: ['payment-before'],
      },
    });
    expect(JSON.stringify(persistedBeforePost)).not.toMatch(
      /Cliente Teste|teste@example|cpf|senha/i,
    );
  });

  it('recupera do armazenamento após reload e repete a chave e o payload exatos', async () => {
    setupRecoveryInvoice();
    restoreAttempt();
    vi.mocked(financeApi.receber).mockResolvedValueOnce({
      pagamento: { id: 'new' } as never,
      repetido: true,
    });
    const onSaved = vi.fn();
    renderRecoveryDialog({ onSaved });
    expect(
      (screen.getByRole('textbox', { name: 'Valor a receber (R$) *' }) as HTMLInputElement).value,
    ).toBe('20.00');
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir recebimento' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(financeApi.receber).toHaveBeenCalledWith(
      receiptContext,
      'reload-invoice',
      recoveredAttempt.key,
      recoveredAttempt.payload,
    );
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
  });

  it('mantém a intenção ao fechar uma resposta incerta', async () => {
    setupRecoveryInvoice();
    restoreAttempt();
    const onClose = vi.fn();
    renderRecoveryDialog({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(recoveryKey)).not.toBeNull();
  });

  it('não envia quando não consegue persistir a intenção', async () => {
    setupRecoveryInvoice();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota');
    });
    renderRecoveryDialog();
    await submitReceipt();
    await screen.findByText(/Não foi possível guardar a tentativa/i);
    expect(financeApi.receber).not.toHaveBeenCalled();
  });

  it('exige persistência disponível também antes de repetir uma tentativa recuperada', async () => {
    setupRecoveryInvoice();
    restoreAttempt();
    vi.mocked(financeApi.receber).mockResolvedValueOnce({
      pagamento: { id: 'new' } as never,
      repetido: true,
    });
    renderRecoveryDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir recebimento' }));
    await screen.findByRole('button', { name: 'Tentar novamente' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText(/Não foi possível guardar a tentativa/i);
    expect(financeApi.receber).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(recoveryKey)).not.toBeNull();
  });

  it.each([
    ['JSON inválido', '{'],
    [
      'payload inválido',
      JSON.stringify({
        version: 1,
        scope: recoveryScope,
        attempt: {
          ...recoveredAttempt,
          payload: { ...recoveredAttempt.payload, pago_em: 'invalid' },
        },
      }),
    ],
    [
      'outro usuário ou tenant',
      JSON.stringify({
        version: 1,
        scope: '["other-user","other-org","area-test","reload-invoice"]',
        attempt: recoveredAttempt,
      }),
    ],
  ])('bloqueia recuperação com %s sem criar outra baixa', async (_name, stored) => {
    setupRecoveryInvoice();
    sessionStorage.setItem(recoveryKey, stored);
    renderRecoveryDialog();
    await screen.findByText(/Não foi possível recuperar a tentativa/i);
    const button = screen.queryByRole('button', { name: 'Confirmar recebimento' });
    if (button) fireEvent.click(button);
    expect(financeApi.receber).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(recoveryKey)).toBe(stored);
  });

  it('não recupera a intenção de outro usuário após troca de sessão', async () => {
    setupRecoveryInvoice();
    restoreAttempt();
    const mounted = renderRecoveryDialog();
    vi.mocked(useSession).mockReturnValue({ session: { usuario: { id: 'other-user' } } } as never);
    mounted.rerender(
      <ReceiveDialog
        context={receiptContext}
        id="reload-invoice"
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      (screen.getByRole('textbox', { name: 'Valor a receber (R$) *' }) as HTMLInputElement).value,
    ).toBe('');
    expect(screen.queryByRole('button', { name: 'Conferir recebimento' })).toBeNull();
    expect(sessionStorage.getItem(recoveryKey)).not.toBeNull();
  });

  it('mantém o bloqueio após sucesso financeiro mesmo que atualizar o cache falhe', async () => {
    setupRecoveryInvoice();
    vi.mocked(financeApi.receber).mockResolvedValueOnce({
      pagamento: { id: 'new' } as never,
      repetido: false,
    });
    renderRecoveryDialog({
      onSaved: vi.fn().mockRejectedValue(new ApiError('Cache indisponível', 503)),
    });
    await submitReceipt();
    await screen.findByText(/Recebimento registrado.*atualizar/i);
    const button = screen.queryByRole('button', { name: 'Confirmar recebimento' });
    if (button) fireEvent.click(button);
    expect(financeApi.receber).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conferir recebimento' })).toBeNull();
  });

  it('preserva a intenção quando aparece outro recebimento parcial sem atribuir o pagamento', async () => {
    setupRecoveryInvoice();
    restoreAttempt();
    vi.mocked(financeApi.mensalidade).mockResolvedValue({
      ...recoveryInvoice,
      status: 'PARCIAL',
      saldo: '30.00',
      pagamentos: [{ id: 'payment-before' }, { id: 'unrelated-payment' }],
    } as Mensalidade);
    const onSaved = vi.fn();
    renderRecoveryDialog({ onSaved });
    fireEvent.click(screen.getByRole('button', { name: 'Conferir recebimento' }));
    await screen.findByText(/histórico de recebimentos/i);
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    expect(sessionStorage.getItem(recoveryKey)).not.toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    expect(financeApi.receber).not.toHaveBeenCalled();
  });

  it('encerra a tentativa ao confirmar no servidor uma mensalidade já quitada', async () => {
    setupRecoveryInvoice();
    restoreAttempt();
    vi.mocked(financeApi.mensalidade).mockResolvedValue({
      ...recoveryInvoice,
      status: 'PAGA',
      saldo: '0.00',
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderRecoveryDialog({ onSaved, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Conferir recebimento' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
    expect(financeApi.receber).not.toHaveBeenCalled();
  });

  it('apaga a intenção após rejeição definitiva do servidor', async () => {
    setupRecoveryInvoice();
    vi.mocked(financeApi.receber).mockRejectedValueOnce(new ApiError('Forma inválida', 400));
    renderRecoveryDialog();
    await submitReceipt();
    await screen.findByText('Forma inválida');
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conferir recebimento' })).toBeNull();
  });

  it('não cria uma intenção incerta quando a consulta falha antes do POST', async () => {
    setupRecoveryInvoice();
    vi.mocked(financeApi.mensalidade).mockRejectedValueOnce(
      new ApiError('Consulta indisponível', 503),
    );
    renderRecoveryDialog();
    await submitReceipt();
    await screen.findByText(/Nenhum recebimento foi enviado/i);
    expect(financeApi.receber).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Conferir recebimento' })).toBeNull();
  });

  it('consulta a mensalidade após conflito de quitação e encerra somente após confirmação', async () => {
    setupRecoveryInvoice();
    vi.mocked(financeApi.receber).mockRejectedValueOnce(
      new ApiError('Mensalidade já paga.', 409, 'MENSALIDADE_JA_PAGA'),
    );
    vi.mocked(financeApi.mensalidade)
      .mockResolvedValueOnce(recoveryInvoice)
      .mockResolvedValueOnce({ ...recoveryInvoice, status: 'PAGA', saldo: '0.00' });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderRecoveryDialog({ onSaved, onClose });
    await submitReceipt();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
    expect(financeApi.receber).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(recoveryKey)).toBeNull();
  });
});
describe('recebimento manual', () => {
  it('bloqueia duplo envio e repete uma tentativa incerta com a mesma chave e payload', async () => {
    const invoice = {
      id: 'm1',
      conta_receber_id: 'conta-1',
      assinatura_id: 'assinatura-1',
      cliente_id: 'cliente-1',
      cliente_nome: 'Cliente Teste',
      competencia: '2026-11-01',
      valor_base: '50.00',
      desconto_recorrente: '0.00',
      ajuste_competencia: '0.00',
      valor_final: '50.00',
      vencimento_em: '2026-11-10',
      status_conta: 'PENDENTE',
      valor_pago: '0.00',
      saldo: '50.00',
      status: 'PENDENTE',
      pagamentos: [],
    } satisfies Mensalidade;
    const refetch = vi.fn().mockResolvedValue({ data: invoice });
    vi.mocked(useFinanceQuery).mockReturnValue({
      data: invoice,
      isPending: false,
      isError: false,
      refetch,
    } as never);
    vi.mocked(financeApi.mensalidade).mockResolvedValue(invoice);
    let failFirst: (error: Error) => void = () => undefined;
    vi.mocked(financeApi.receber)
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            failFirst = reject;
          }),
      )
      .mockResolvedValueOnce({ pagamento: { id: 'p1' } as never, repetido: false });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
      <ReceiveDialog
        context={{ organizacaoId: 'org-test', areaId: 'area-test' }}
        id="m1"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Valor a receber (R$) *' }), {
      target: { value: '20,00' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Forma de pagamento *' }), {
      target: { value: 'PIX' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
    await waitFor(() => expect(financeApi.receber).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Registrando...' }));
    expect(financeApi.receber).toHaveBeenCalledOnce();
    failFirst(new ApiError('Tempo esgotado', 0));
    expect(
      await screen.findByText(
        'Ainda não conseguimos confirmar o pagamento. Consulte a situação antes de tentar novamente.',
      ),
    ).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    expect(screen.getByText('Valor em aberto')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir recebimento' }));
    await screen.findByRole('button', { name: 'Tentar novamente' });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(financeApi.receber).toHaveBeenCalledTimes(2));
    expect(vi.mocked(financeApi.receber).mock.calls[1][2]).toBe(
      vi.mocked(financeApi.receber).mock.calls[0][2],
    );
    expect(vi.mocked(financeApi.receber).mock.calls[1][3]).toEqual(
      vi.mocked(financeApi.receber).mock.calls[0][3],
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('após 503 e pagamento confirmado, consulta o servidor e impede outro envio', async () => {
    const invoice = {
      id: 'm2',
      conta_receber_id: 'conta-2',
      assinatura_id: 'assinatura-2',
      cliente_id: 'cliente-2',
      cliente_nome: 'Cliente Teste',
      competencia: '2026-11-01',
      valor_base: '50.00',
      desconto_recorrente: '0.00',
      ajuste_competencia: '0.00',
      valor_final: '50.00',
      vencimento_em: '2026-11-10',
      status_conta: 'PENDENTE',
      valor_pago: '0.00',
      saldo: '50.00',
      status: 'PENDENTE',
      pagamentos: [],
    } satisfies Mensalidade;
    const paid = {
      ...invoice,
      saldo: '0.00',
      status: 'PAGA' as const,
      pagamentos: [
        {
          id: 'p2',
          valor: '20.00',
          forma_pagamento: 'PIX',
          origem: 'MANUAL',
          pago_em: '2026-11-10T12:00:00.000Z',
          criado_em: '2026-11-10T12:00:00.000Z',
        },
      ],
    } satisfies Mensalidade;
    vi.mocked(useFinanceQuery).mockReturnValue({
      data: invoice,
      isPending: false,
      isError: false,
      refetch: vi.fn().mockResolvedValue({ data: paid }),
    } as never);
    vi.mocked(financeApi.mensalidade).mockResolvedValueOnce(invoice).mockResolvedValueOnce(paid);
    vi.mocked(financeApi.receber).mockRejectedValueOnce(new ApiError('Serviço indisponível', 503));
    const onSaved = vi.fn();
    render(
      <ReceiveDialog
        context={{ organizacaoId: 'org-test', areaId: 'area-test' }}
        id="m2"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Valor a receber (R$) *' }), {
      target: { value: '20,00' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Forma de pagamento *' }), {
      target: { value: 'PIX' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recebimento' }));
    expect(
      await screen.findByText(
        'Ainda não conseguimos confirmar o pagamento. Consulte a situação antes de tentar novamente.',
      ),
    ).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    expect(screen.getByText('Valor em aberto')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Conferir recebimento' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(
      screen.getByRole('button', { name: 'Confirmar recebimento' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(financeApi.receber).toHaveBeenCalledOnce();
  });
});
