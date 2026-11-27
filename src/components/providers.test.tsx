import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Providers } from './providers';
import { SessionProvider } from '@/features/auth/session';
import { PwaRegister } from './pwa-register';

vi.mock('next/navigation', () => ({ usePathname: () => '/pagamento/retorno' }));
vi.mock('@/features/auth/session', () => ({ SessionProvider: vi.fn(() => null) }));
vi.mock('./pwa-register', () => ({ PwaRegister: vi.fn(() => null) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('não inicializa sessão, dados administrativos ou PWA na página de pagamento', () => {
  render(
    <Providers>
      <p>Pagamento privado</p>
    </Providers>,
  );
  expect(screen.getByText('Pagamento privado')).toBeTruthy();
  expect(SessionProvider).not.toHaveBeenCalled();
  expect(PwaRegister).not.toHaveBeenCalled();
});
