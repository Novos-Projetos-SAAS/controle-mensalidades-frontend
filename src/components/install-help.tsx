'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export function InstallHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const check = () =>
      setInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    check();
    window.addEventListener('appinstalled', check);
    return () => window.removeEventListener('appinstalled', check);
  }, []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="display pr-10 text-3xl">Instale o Orbe</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          {installed
            ? 'O Orbe já está aberto como aplicativo.'
            : 'Após a publicação com HTTPS, instale pelo navegador do celular.'}
        </DialogDescription>
        {!installed && (
          <div className="mt-6 space-y-5 text-sm">
            <div className="rounded-xl bg-teal-50 p-4">
              <h3 className="font-semibold text-teal-900">Android · Chrome</h3>
              <p className="mt-2 leading-relaxed text-slate-700">
                Abra o menu do navegador e toque em <strong>Instalar app</strong> ou{' '}
                <strong>Adicionar à tela inicial</strong>.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">iPhone · Safari</h3>
              <p className="mt-2 leading-relaxed text-slate-700">
                Toque em <strong>Compartilhar</strong> e depois em{' '}
                <strong>Adicionar à Tela de Início</strong>.
              </p>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Seus dados precisam de conexão para serem consultados e atualizados.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
