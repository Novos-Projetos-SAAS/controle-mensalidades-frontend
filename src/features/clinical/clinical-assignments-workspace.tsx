'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session';
import { clientes, profissionais } from '@/lib/api';
import { vinculosClinicosApi } from './clinical-assignments-api';
import type { ClinicalContext } from './clinical-api';

/**
 * Fluxo administrativo para vincular pacientes de TESTE ao profissional.
 * Nunca retorna texto clínico e não dá permissão ao administrador para
 * consultar prontuários. A autorização é sempre validada no backend.
 */
export function ClinicalAssignmentsWorkspace() {
  const { organization, area, session } = useSession();
  const queryClient = useQueryClient();
  const [clienteId, setClienteId] = useState('');
  const [profissionalId, setProfissionalId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const organizationId = organization?.id ?? '';
  const areaId = area?.id ?? '';
  const usuarioId = session?.usuario.id ?? '';
  const administrador = organization?.perfil === 'ADMINISTRADOR';
  const pronto = administrador && !!usuarioId && !!organizationId && !!areaId;
  const contexto: ClinicalContext = { organizacaoId: organizationId, areaId };

  const listaPacientes = useQuery({
    queryKey: ['vinculos-clinicos', 'pacientes', usuarioId, organizationId, areaId],
    queryFn: () => clientes(organizationId, areaId),
    enabled: pronto,
    retry: false,
  });
  const listaProfissionais = useQuery({
    queryKey: ['vinculos-clinicos', 'profissionais', usuarioId, organizationId, areaId],
    queryFn: () => profissionais(organizationId, areaId),
    enabled: pronto,
    retry: false,
  });
  const vinculos = useQuery({
    queryKey: ['vinculos-clinicos', 'vinculos', usuarioId, organizationId, areaId, clienteId],
    queryFn: () => vinculosClinicosApi.listar(contexto, clienteId),
    enabled: pronto && !!clienteId,
    retry: false,
  });

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    if (salvando || !pronto) return;
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      await acao();
      await queryClient.invalidateQueries({
        queryKey: ['vinculos-clinicos', 'vinculos', usuarioId, organizationId, areaId],
      });
      setMensagem(sucesso);
      setMotivo('');
    } catch {
      setErro('Não foi possível atualizar o vínculo. Confira as permissões e os dados informados.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppShell>
      <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <ShieldCheck size={20} aria-hidden className="mb-2" />
        <strong>Vínculos clínicos — homologação com pacientes fictícios</strong>
        <p className="mt-2">As autorizações são salvas no PostgreSQL. Não utilize pacientes reais;
          o prontuário oficial ainda não está liberado.</p>
      </section>
      <h1 className="display mb-5 text-3xl">Vincular fisioterapeuta e paciente</h1>
      {!administrador ? (
        <p role="alert" className="surface p-5 text-sm">Esta operação é exclusiva de administradores da organização.</p>
      ) : !areaId ? (
        <p role="status" className="surface p-5 text-sm">Selecione a área de fisioterapia.</p>
      ) : (
        <div className="surface max-w-4xl space-y-5 p-5">
          {(listaPacientes.isError || listaProfissionais.isError) && (
            <p role="alert" className="text-sm text-red-800">Não foi possível consultar os cadastros para o vínculo.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="field-label">Paciente cadastrado *</span>
              <select className="select-field" value={clienteId} onChange={(e) => {
                setClienteId(e.target.value); setMensagem(''); setErro('');
              }} disabled={!listaPacientes.data || salvando}>
                <option value="">Selecione um paciente fictício</option>
                {listaPacientes.data?.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Fisioterapeuta *</span>
              <select className="select-field" value={profissionalId}
                onChange={(e) => setProfissionalId(e.target.value)}
                disabled={!listaProfissionais.data || salvando}>
                <option value="">Selecione um profissional autorizado</option>
                {listaProfissionais.data?.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </label>
          </div>

          <Button disabled={!clienteId || !profissionalId || salvando}
            onClick={() => void executar(
              () => vinculosClinicosApi.conceder(contexto, clienteId, profissionalId),
              'Vínculo registrado no banco. O profissional pode acessar somente seus pacientes.',
            )}>
            <Link2 size={16} aria-hidden /> Conceder vínculo
          </Button>
          {mensagem && <p role="status" className="text-sm text-teal-800">{mensagem}</p>}
          {erro && <p role="alert" className="text-sm text-red-800">{erro}</p>}

          {clienteId && (
            <section className="space-y-4 border-t border-slate-200 pt-5">
              <h2 className="text-lg font-semibold">Autorizações do paciente</h2>
              {vinculos.isPending ? <p role="status" className="text-sm">Carregando vínculos…</p>
                : vinculos.isError ? (
                  <p role="alert" className="text-sm text-red-800">
                    Não foi possível consultar os vínculos. A API clínica pode estar bloqueada.
                  </p>
                ) : vinculos.data?.length === 0 ? (
                  <p className="text-sm text-slate-600">Ainda não existem vínculos registrados.</p>
                ) : (
                  <ul className="space-y-3">
                    {vinculos.data?.map((item) => {
                      const nome = listaProfissionais.data?.find((p) => p.id === item.profissional_id)?.nome ??
                        'Profissional cadastrado';
                      return (
                        <li key={item.id} className="rounded-xl border border-slate-200 p-4">
                          <p className="font-medium">{nome}</p>
                          <p className="text-xs text-slate-600">
                            {item.revogado_em ? 'Vínculo revogado' : 'Vínculo ativo'}
                          </p>
                          {!item.revogado_em && (
                            <div className="mt-3 space-y-2">
                              <label className="block">
                                <span className="field-label">Motivo para revogação *</span>
                                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                                  className="select-field min-h-20" maxLength={500}
                                  placeholder="Explique o encerramento da autorização" />
                              </label>
                              <Button variant="outline" disabled={salvando || motivo.trim().length < 10}
                                onClick={() => {
                                  if (!window.confirm('Revogar o acesso deste fisioterapeuta ao paciente?')) return;
                                  void executar(
                                    () => vinculosClinicosApi.revogar(contexto, item.id, motivo),
                                    'A autorização foi revogada no banco.',
                                  );
                                }}>
                                Revogar acesso
                              </Button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
