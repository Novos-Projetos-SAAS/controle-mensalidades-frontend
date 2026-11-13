'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, LoadingState } from '@/components/query-state';

type User = { id: string; nome: string; email: string; ativo: boolean; perfil: string };
type CurrentLink = {
  profissionalId: string;
  usuario: { id: string; nome: string } | null;
  vinculoAtivo: boolean;
};
const schema = z.object({ usuarioId: z.uuid('Selecione um usuário.') });
type Values = z.infer<typeof schema>;

export function LinkUserDialog({
  professionalId,
  organizationId,
  areaId,
  onClose,
  onLinked,
}: {
  professionalId: string | null;
  organizationId: string;
  areaId: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const close = () => {
    setConfirmUnlink(false);
    onClose();
  };
  const queryClient = useQueryClient();
  const linkKey = ['vinculo-usuario', organizationId, areaId, professionalId];
  const current = useQuery({
    queryKey: linkKey,
    queryFn: () =>
      api<CurrentLink>(
        `/profissionais/${professionalId}/usuario`,
        {},
        { organizacaoId: organizationId, areaId },
      ),
    enabled: !!professionalId && !!organizationId && !!areaId,
  });
  const users = useQuery({
    queryKey: ['usuarios', organizationId],
    queryFn: () => api<User[]>('/usuarios', {}, { organizacaoId: organizationId }),
    enabled: !!professionalId && !!organizationId,
  });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { usuarioId: '' } });
  const { reset } = form;
  useEffect(() => {
    if (professionalId) reset({ usuarioId: '' });
  }, [professionalId, reset]);
  const submit = form.handleSubmit(async ({ usuarioId }) => {
    if (!professionalId) return;
    try {
      await api(
        `/profissionais/${professionalId}/usuario`,
        {
          method: 'PATCH',
          body: JSON.stringify({ usuarioId }),
        },
        { organizacaoId: organizationId, areaId },
      );
      toast.success('Usuário vinculado ao profissional.');
      await queryClient.invalidateQueries({ queryKey: linkKey });
      onLinked();
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o usuário.');
    }
  });
  const unlink = async () => {
    if (!professionalId || unlinking) return;
    setUnlinking(true);
    try {
      await api(
        `/profissionais/${professionalId}/usuario`,
        { method: 'PATCH', body: JSON.stringify({ usuarioId: null }) },
        { organizacaoId: organizationId, areaId },
      );
      toast.success('Vínculo removido.');
      setConfirmUnlink(false);
      await queryClient.invalidateQueries({ queryKey: linkKey });
      onLinked();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o vínculo.');
    } finally {
      setUnlinking(false);
    }
  };
  return (
    <Dialog open={!!professionalId} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="display pr-10 text-3xl">Vincular usuário</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          Selecione uma conta ativa da organização para associar ao profissional.
        </DialogDescription>
        <p className="mt-4 rounded-xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-900">
          Esta ação não concede acesso clínico.
        </p>
        {current.isPending ? (
          <div className="mt-5">
            <LoadingState rows={1} />
          </div>
        ) : current.isError ? (
          <div className="mt-5">
            <ErrorState message={current.error.message} retry={() => current.refetch()} />
          </div>
        ) : current.data?.usuario ? (
          <div className="mt-5 rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Vínculo atual</p>
            <p className="mt-1 font-semibold">{current.data.usuario.nome}</p>
            <p className="mt-1 text-xs text-slate-600">
              {current.data.vinculoAtivo ? 'Vínculo ativo' : 'Vínculo inativo'}
            </p>
            {confirmUnlink ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-amber-900">
                  Remover o vínculo altera o acesso desta conta. Confirme para continuar.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmUnlink(false)}
                    disabled={unlinking}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={unlink} disabled={unlinking}>
                    {unlinking ? 'Removendo...' : 'Confirmar remoção'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => setConfirmUnlink(true)}
              >
                Remover vínculo
              </Button>
            )}
          </div>
        ) : users.isPending ? (
          <div className="mt-5">
            <LoadingState rows={2} />
          </div>
        ) : users.isError ? (
          <div className="mt-5">
            <ErrorState message={users.error.message} retry={() => users.refetch()} />
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="text-sm text-slate-600">Nenhum usuário vinculado nesta área.</p>
            <label className="block">
              <span className="field-label">Usuário</span>
              <select
                className="select-field"
                {...form.register('usuarioId')}
                aria-invalid={!!form.formState.errors.usuarioId}
              >
                <option value="">Selecione um usuário</option>
                {users.data
                  .filter((user) => user.ativo)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.nome} · {user.email}
                    </option>
                  ))}
              </select>
              {form.formState.errors.usuarioId && (
                <span role="alert" className="mt-1 block text-xs text-red-700">
                  {form.formState.errors.usuarioId.message}
                </span>
              )}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Vinculando...' : 'Vincular usuário'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
