'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  UsersRound,
  BriefcaseBusiness,
  LogOut,
  Menu,
  X,
  WifiOff,
  Orbit,
  Download,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/features/auth/session';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InstallHelp } from '@/components/install-help';

const links = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: UsersRound },
  { href: '/profissionais', label: 'Profissionais', icon: BriefcaseBusiness },
  { href: '/financeiro', label: 'Financeiro', icon: WalletCards },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    session,
    loading,
    error,
    organization,
    area,
    availableAreas,
    selectOrganization,
    selectArea,
    signOut,
    retry,
  } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-700 border-t-transparent" />
        <span className="sr-only">Carregando sessão</span>
      </div>
    );
  if (!session) {
    return <div className="min-h-screen" />;
  }
  const currentTitle = links.find((link) => link.href === path)?.label || 'Gestão';
  const nav = (
    <>
      <div className="mb-10 flex items-center gap-3 px-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-teal-700 text-xl font-bold text-white">
          <Orbit size={23} aria-hidden="true" />
        </div>
        <div>
          <strong className="display text-2xl leading-none text-slate-900">orbe</strong>
          <p className="text-[10px] font-bold tracking-[.22em] text-teal-700 uppercase">
            gestão integrada
          </p>
        </div>
      </div>
      <p className="mb-3 px-3 text-[11px] font-bold tracking-[.16em] text-slate-400 uppercase">
        Workspace
      </p>
      <nav aria-label="Navegação principal" className="space-y-1">
        {links
          .filter((link) => link.href !== '/financeiro' || organization?.perfil === 'ADMINISTRADOR')
          .map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              aria-current={path === link.href ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700',
                path === link.href ? 'bg-teal-800 text-white hover:bg-teal-800' : 'text-slate-600',
              )}
            >
              <link.icon size={18} aria-hidden="true" />
              {link.label}
            </Link>
          ))}
      </nav>
      <div className="mt-auto border-t border-slate-200 px-2 pt-6">
        <p className="px-1 text-xs leading-relaxed text-slate-500">
          Sua operação em um lugar claro e organizado.
        </p>
        <button
          onClick={() => {
            setMenuOpen(false);
            setInstallOpen(true);
          }}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <Download size={18} aria-hidden="true" /> Instalar aplicativo
        </button>
        <button
          onClick={async () => {
            try {
              await signOut();
              router.replace('/login');
            } catch {
              toast.error('Não foi possível encerrar a sessão.');
            }
          }}
          className="mt-4 flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <LogOut size={18} aria-hidden="true" /> Sair da conta
        </button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen lg:flex">
      <InstallHelp open={installOpen} onOpenChange={setInstallOpen} />
      <aside className="hidden w-[252px] shrink-0 flex-col border-r border-slate-200 bg-white p-5 lg:fixed lg:inset-y-0 lg:flex">
        {nav}
      </aside>
      <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="mobile-drawer fixed inset-y-0 left-0 z-50 flex w-[90vw] max-w-[320px] flex-col overflow-y-auto bg-white p-5 shadow-2xl focus:outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Menu principal</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Fechar menu"
              className="mb-3 ml-auto grid size-11 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              <X aria-hidden="true" />
            </DialogPrimitive.Close>
            {nav}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <div className="min-w-0 flex-1 lg:ml-[252px]">
        <header className="app-header sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </Button>
            <div>
              <p className="text-[11px] font-bold tracking-[.16em] text-teal-700 uppercase">
                Painel de gestão
              </p>
              <strong className="text-base font-semibold text-slate-900">{currentTitle}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right xl:block">
              <p className="text-sm font-semibold">{session.usuario.nome}</p>
              <p className="text-xs text-slate-500">{session.usuario.email}</p>
            </div>
            <div
              className="hidden size-10 place-items-center rounded-full bg-teal-100 font-bold text-teal-800 sm:grid"
              aria-hidden="true"
            >
              {session.usuario.nome[0]}
            </div>
          </div>
        </header>
        <main className="app-main mx-auto max-w-[1480px] px-4 pt-7 sm:px-7 lg:px-10">
          <div className="mb-7 flex flex-col gap-4 rounded-2xl border border-teal-100 bg-[#eaf4f2] p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="mr-auto">
              <p className="text-[11px] font-bold tracking-[.15em] text-teal-700 uppercase">
                Contexto ativo
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Escolha a organização e a área para trabalhar.
              </p>
            </div>
            <label className="min-w-0 flex-1 sm:max-w-[230px]">
              <span className="field-label">Organização</span>
              <select
                className="select-field"
                value={organization?.id || ''}
                onChange={(event) => selectOrganization(event.target.value)}
              >
                {session.organizacoes.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 sm:max-w-[230px]">
              <span className="field-label">Área de negócio</span>
              <select
                className="select-field"
                value={area?.id || ''}
                onChange={(event) => selectArea(event.target.value)}
                disabled={!availableAreas.length}
              >
                <option value="">
                  {availableAreas.length ? 'Selecione' : 'Nenhuma área disponível'}
                </option>
                {availableAreas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <WifiOff size={18} aria-hidden="true" />
              {error}
              <Button variant="outline" size="sm" onClick={retry}>
                Tentar novamente
              </Button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
