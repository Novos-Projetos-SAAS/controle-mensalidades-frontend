import { AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" className="surface space-y-4 p-6">
      <span className="sr-only">Carregando dados</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="surface flex flex-col items-start gap-3 p-7">
      <AlertCircle className="text-red-700" />
      <h2 className="font-semibold">Não foi possível carregar os dados</h2>
      <p className="text-sm text-slate-600">{message}</p>
      <Button variant="outline" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center p-10 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-teal-50 text-teal-800">
        <Inbox size={27} />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-600">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
