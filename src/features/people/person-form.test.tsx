import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PersonForm } from './person-form';
import { api } from '@/lib/api';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
});

describe('cadastro de cliente', () => {
  const props = {
    kind: 'clientes' as const,
    open: true,
    onOpenChange: vi.fn(),
    areas: [{ id: 'area-1', nome: 'Área A' }],
    organizationId: 'org-1',
    areaId: 'area-1',
    onSaved: vi.fn(),
  };
  it('indica o nome obrigatório antes de enviar', async () => {
    render(<PersonForm {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
    expect(await screen.findByText('Informe o nome.')).toBeTruthy();
    expect(vi.mocked(api)).not.toHaveBeenCalled();
  });
  it('recusa CPF com dígitos verificadores incorretos antes de enviar', async () => {
    render(<PersonForm {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Nome completo/ }), {
      target: { value: 'Cliente de Teste' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'CPF' }), {
      target: { value: '12345678901' },
    });
    expect((screen.getByRole('textbox', { name: 'CPF' }) as HTMLInputElement).value).toBe(
      '123.456.789-01',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
    expect(await screen.findByText('CPF inválido. Confira os dígitos.')).toBeTruthy();
    expect(vi.mocked(api)).not.toHaveBeenCalled();
  });

  it('exibe máscaras e envia CPF e telefone normalizados', async () => {
    vi.mocked(api).mockResolvedValue({} as never);
    render(<PersonForm {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Nome completo/ }), {
      target: { value: 'Cliente CPF Válido' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'CPF' }), {
      target: { value: '52998224725' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefone' }), {
      target: { value: '11999998888' },
    });
    expect((screen.getByRole('textbox', { name: 'CPF' }) as HTMLInputElement).value).toBe(
      '529.982.247-25',
    );
    expect((screen.getByRole('textbox', { name: 'Telefone' }) as HTMLInputElement).value).toBe(
      '(11) 99999-8888',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledOnce());
    const options = vi.mocked(api).mock.calls[0]?.[1];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      cpf: '52998224725',
      telefone: '11999998888',
    });
  });

  it('envia somente campos suportados com o contexto correto', async () => {
    vi.mocked(api).mockResolvedValue({} as never);
    render(<PersonForm {...props} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Nome completo/ }), {
      target: { value: 'Cliente de Teste' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));
    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledOnce());
    const [path, options, context] = vi.mocked(api).mock.calls[0];
    if (!options) throw new Error('Opções HTTP ausentes.');
    expect(path).toBe('/clientes');
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({
      nome: 'Cliente de Teste',
      areas: ['area-1'],
    });
    expect(context).toEqual({ organizacaoId: 'org-1', areaId: 'area-1' });
  });
});
