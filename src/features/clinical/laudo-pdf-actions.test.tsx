import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/lib/api';
import { LaudoPdfActions } from './laudo-pdf-actions';

const ids = {
  organizacaoId: '11111111-1111-4111-8111-111111111111',
  areaId: '22222222-2222-4222-8222-222222222222',
};
const mock = vi.hoisted(() => ({
  pdfLaudo: vi.fn(),
}));
vi.mock('./clinical-api', () => ({ clinicalApi: mock }));

const contexto = ids;
const documentoId = '33333333-3333-4333-8333-333333333333';
let criar: ReturnType<typeof vi.fn>;
let revogar: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  criar = vi.fn(() => 'blob:laudo-ficticio');
  revogar = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: criar });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revogar });
  mock.pdfLaudo.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('prévia e impressão do laudo', () => {
  it('exige clique para baixar, não obtém dados no carregamento e abre PDF protegido', async () => {
    render(<LaudoPdfActions contexto={contexto} documentoId={documentoId}
      versao={2} estado="FINALIZADO" historica={false} />);
    expect(mock.pdfLaudo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar PDF' }));
    expect(await screen.findByTitle('Prévia do laudo fisioterapêutico, versão 2')).toBeTruthy();
    expect(mock.pdfLaudo).toHaveBeenCalledOnce();
    expect(mock.pdfLaudo).toHaveBeenCalledWith(contexto, documentoId, 2);
    expect(screen.getByText('Documento finalizado para impressão e assinatura física, sem assinatura digital.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar prévia' }));
    await waitFor(() => expect(revogar).toHaveBeenCalledWith('blob:laudo-ficticio'));
  });

  it('não permite prévia para conta que perdeu o vínculo clínico', async () => {
    mock.pdfLaudo.mockRejectedValue(new ApiError('Proibido', 403, 'ACESSO_CLINICO_NEGADO'));
    render(<LaudoPdfActions contexto={contexto} documentoId={documentoId}
      versao={1} estado="RASCUNHO" historica={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar PDF' }));
    expect(await screen.findByText('Você não tem acesso a este laudo ou o vínculo clínico foi encerrado.')).toBeTruthy();
    expect(criar).not.toHaveBeenCalled();
    expect(screen.queryByTitle('Prévia do laudo fisioterapêutico, versão 1')).toBeNull();
  });

  it('identifica cópia histórica e não cria assinatura digital', () => {
    render(<LaudoPdfActions contexto={contexto} documentoId={documentoId}
      versao={1} estado="RASCUNHO" historica />);
    expect(screen.getByText('Cópia de versão histórica.', { exact: false })).toBeTruthy();
    expect(mock.pdfLaudo).not.toHaveBeenCalled();
  });
});
