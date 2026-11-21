'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Building2, Layers3, Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from '@/features/auth/session';
import { createBusinessArea, createOrganization } from './organizations-api';

function readableError(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.';
}

export function OrganizationsPage() {
  const {
    organization,
    session,
    availableAreas,
    selectOrganization,
    selectArea,
    refreshOrganizations,
  } = useSession();
  const [companyName, setCompanyName] = useState('');
  const [firstArea, setFirstArea] = useState('');
  const [areaName, setAreaName] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [creatingArea, setCreatingArea] = useState(false);
  const [error, setError] = useState('');
  const [areaError, setAreaError] = useState('');

  async function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingCompany) return;
    const nome = companyName.trim();
    const area = firstArea.trim();
    if (nome.length < 2 || area.length < 2) {
      setError('Informe o nome da organização e da primeira área (mínimo de 2 caracteres).');
      return;
    }
    setError('');
    setCreatingCompany(true);
    let created = false;
    try {
      const result = await createOrganization(nome, area);
      created = true;
      await refreshOrganizations(result.organizacao.id, result.area.id);
      setCompanyName('');
      setFirstArea('');
      toast.success('Organização criada. Você é o administrador deste negócio.');
    } catch (cause) {
      if (created) {
        toast.warning('A empresa foi criada. Atualize a página para consultar seu novo acesso.');
      } else {
        setError(readableError(cause));
      }
    } finally {
      setCreatingCompany(false);
    }
  }

  async function submitArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || organization.perfil !== 'ADMINISTRADOR' || creatingArea) return;
    const nome = areaName.trim();
    if (nome.length < 2) {
      setAreaError('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    setAreaError('');
    setCreatingArea(true);
    let created = false;
    try {
      const result = await createBusinessArea(organization.id, nome);
      created = true;
      await refreshOrganizations(organization.id, result.id);
      setAreaName('');
      toast.success('Área criada e selecionada.');
    } catch (cause) {
      if (created) {
        toast.warning('A área foi criada. Atualize a página para consultar a lista.');
      } else {
        setAreaError(readableError(cause));
      }
    } finally {
      setCreatingArea(false);
    }
  }

  return (
    <AppShell>
      <section className="space-y-6 pb-10">
        <header>
          <p className="text-xs font-bold tracking-[.15em] text-teal-700 uppercase">
            Configurações
          </p>
          <h1 className="display mt-1 text-3xl text-slate-900 sm:text-4xl">
            Organizações e áreas
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Uma única conta pode participar de várias empresas. Seu perfil é independente
            em cada uma delas.
          </p>
        </header>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="surface space-y-4 p-5 sm:p-6" aria-labelledby="my-organizations">
            <h2 id="my-organizations" className="flex items-center gap-2 text-xl font-semibold">
              <Building2 aria-hidden="true" size={22} /> Minhas organizações
            </h2>
            <ul className="space-y-3">
              {session?.organizacoes.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <p className="font-semibold">{item.nome}</p>
                    <p className="text-xs text-slate-600">
                      {item.perfil === 'ADMINISTRADOR' ? 'Administrador' : 'Operador'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-pressed={organization?.id === item.id}
                    disabled={organization?.id === item.id}
                    onClick={() => selectOrganization(item.id)}
                  >
                    {organization?.id === item.id ? 'Selecionada' : 'Selecionar'}
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface space-y-4 p-5 sm:p-6" aria-labelledby="create-organization">
            <h2 id="create-organization" className="flex items-center gap-2 text-xl font-semibold">
              <Plus aria-hidden="true" size={22} /> Criar nova organização
            </h2>
            <p className="text-sm text-slate-600">
              Abra um negócio independente. Você será administrador da nova organização,
              sem alterar seu acesso às empresas existentes.
            </p>
            <form onSubmit={submitCompany} className="space-y-4">
              <label className="block">
                <span className="field-label">Nome da empresa</span>
                <Input
                  required
                  minLength={2}
                  maxLength={150}
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Ex.: Academia Movimento"
                />
              </label>
              <label className="block">
                <span className="field-label">Primeira área de negócio</span>
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  value={firstArea}
                  onChange={(event) => setFirstArea(event.target.value)}
                  placeholder="Ex.: Musculação, Pilates ou Fisioterapia"
                />
              </label>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <Button type="submit" disabled={creatingCompany}>
                {creatingCompany ? 'Criando organização...' : 'Criar organização'}
              </Button>
            </form>
          </section>
        </div>

        <section className="surface space-y-4 p-5 sm:p-6" aria-labelledby="business-areas">
          <h2 id="business-areas" className="flex items-center gap-2 text-xl font-semibold">
            <Layers3 aria-hidden="true" size={22} /> Áreas de {organization?.nome ?? 'negócio'}
          </h2>
          <p className="text-sm text-slate-600">
            Cada área possui seus próprios vínculos de clientes, profissionais e configurações.
            Somente administradores desta organização podem criar novas áreas.
          </p>
          <ul aria-label="Áreas disponíveis" className="flex flex-wrap gap-2">
            {availableAreas.map((item) => (
              <li key={item.id}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectArea(item.id)}
                >
                  {item.nome}
                </Button>
              </li>
            ))}
            {availableAreas.length === 0 && (
              <li className="text-sm text-slate-500">Nenhuma área ativa cadastrada.</li>
            )}
          </ul>
          {organization?.perfil === 'ADMINISTRADOR' ? (
            <form onSubmit={submitArea} className="max-w-xl space-y-3 border-t border-slate-200 pt-4">
              <label className="block">
                <span className="field-label">Nome da nova área</span>
                <Input
                  required
                  minLength={2}
                  maxLength={100}
                  value={areaName}
                  onChange={(event) => setAreaName(event.target.value)}
                  placeholder="Ex.: Pilates"
                />
              </label>
              {areaError && <p role="alert" className="text-sm text-red-700">{areaError}</p>}
              <Button type="submit" disabled={creatingArea}>
                {creatingArea ? 'Criando área...' : 'Adicionar área'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">
              Para criar áreas nesta empresa, peça acesso de administrador ao responsável.
            </p>
          )}
        </section>
      </section>
    </AppShell>
  );
}
