'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({
  children,
  className,
  onCloseAutoFocus,
}: {
  children: React.ReactNode;
  className?: string;
  onCloseAutoFocus?: React.ComponentProps<typeof DialogPrimitive.Content>['onCloseAutoFocus'];
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/55" />
      <DialogPrimitive.Content
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          'fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-xl -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-2xl focus:outline-none',
          className,
        )}
      >
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-700"
          aria-label="Fechar"
        >
          <X size={18} />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
