import { afterEach, describe, expect, it, vi } from 'vitest';
import { vinculosClinicosApi } from './clinical-assignments-api';

const contexto = {
  organizacaoId: '11111111-1111-4111-8111-111111111111',
  areaId: '22222222-2222-4222-8222-222222222222',
};
const paciente = '33333333-3333-4333-8333-333333333333';
const profissional = '44444444-4444-4444-8444-444444444444';
const vinculo = '55555555-5555-4555-8555-555555555555';

const stub = (data: unknown, status = 200) => {
  const busca = vi.fn(async (_url: string, _options?: RequestInit) => new Response(
    JSON.stringify(status < 400 ? { data } : data),
    { status, headers: { 'content-type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', busca);
  return busca;
};

afterEach(() => vi.unstubAllGlobals());

describe('contrato administrativo de vinculo clinico', () => {
  it('lista somente o paciente escolhido, com escopo autenticado e sem cache', async () => {
    const fetchMock = stub([]);
    expect(await vinculosClinicosApi.listar(contexto, paciente)).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/vinculos-clinicos/paciente/${paciente}`);
    expect(init).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'x-organizacao-id': contexto.organizacaoId,
        'x-area-negocio-id': contexto.areaId,
      },
    });
  });

  it('concede somente os IDs, sem dados clinicos no corpo ou na URL', async () => {
    const fetchMock = stub({ id: vinculo, cliente_id: paciente, profissional_id: profissional });
    await vinculosClinicosApi.conceder(contexto, paciente, profissional);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/vinculos-clinicos');
    expect(JSON.parse(String(init?.body))).toEqual({
      cliente_id: paciente, profissional_id: profissional,
    });
  });

  it('consulta usuario profissional em endpoint administrativo sem incluir registros clinicos', async () => {
    const fetchMock = stub({ profissionalId: profissional, vinculoAtivo: true, usuario: { id: 'usuario-teste', nome: 'Profissional fictício' } });
    const resultado = await vinculosClinicosApi.consultarUsuarioProfissional(contexto, profissional);
    expect(resultado.vinculoAtivo).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/profissionais/${profissional}/usuario`);
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.headers).toMatchObject({
      'x-organizacao-id': contexto.organizacaoId,
      'x-area-negocio-id': contexto.areaId,
    });
  });

  it('habilita acesso clinico somente por acao administrativa explicita no profissional escolhido', async () => {
    const fetchMock = stub({ profissionalId: profissional, areaNegocioId: contexto.areaId, autorizado: true });
    const resultado = await vinculosClinicosApi.autorizarAcessoClinico(contexto, profissional);
    expect(resultado.autorizado).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/profissionais/${profissional}/acesso-clinico`);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ autorizado: true });
    expect(init?.headers).toMatchObject({
      'x-organizacao-id': contexto.organizacaoId,
      'x-area-negocio-id': contexto.areaId,
    });
  });

  it('revogacao exige motivo nao vazio e elimina tentativa de ID malformado', async () => {
    const fetchMock = stub({ id: vinculo, revogado: true });
    expect(() => vinculosClinicosApi.revogar(contexto, vinculo, 'curto')).toThrow();
    expect(() => vinculosClinicosApi.listar(contexto, `${paciente}/segredo`)).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    await vinculosClinicosApi.revogar(contexto, vinculo, 'Encerramento do tratamento ficticio');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/v1/vinculos-clinicos/${vinculo}/revogar`);
    expect(JSON.parse(String(init?.body))).toEqual({
      motivo: 'Encerramento do tratamento ficticio',
    });
  });

  it('não contorna o gate 403 do backend', async () => {
    stub({ mensagem: 'Acesso clínico bloqueado.', codigo: 'ACESSO_CLINICO_NAO_CONFIGURADO' }, 403);
    await expect(vinculosClinicosApi.listar(contexto, paciente)).rejects.toMatchObject({
      status: 403,
      code: 'ACESSO_CLINICO_NAO_CONFIGURADO',
    });
  });
});
