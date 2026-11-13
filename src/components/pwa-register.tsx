'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (reg.waiting)
          toast.info('Atualização disponível', {
            description: 'Uma nova versão do aplicativo está pronta.',
            action: {
              label: 'Atualizar',
              onClick: () => reg.waiting?.postMessage({ type: 'SKIP_WAITING' }),
            },
          });
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller)
              toast.info('Atualização disponível', {
                action: {
                  label: 'Atualizar',
                  onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }),
                },
              });
          });
        });
      })
      .catch(() => undefined);
    const reload = () => {
      if (hadController) window.location.reload();
      else hadController = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange', reload);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', reload);
  }, []);
  return null;
}
