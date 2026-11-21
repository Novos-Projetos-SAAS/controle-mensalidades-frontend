'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  areas,
  login,
  logout,
  me,
  type Area,
  type Organizacao,
  type Sessao,
} from '@/lib/api';

type SessionContextValue = {
  session: Sessao | null;
  loading: boolean;
  error: string | null;
  organization: Organizacao | null;
  area: Area | null;
  availableAreas: Area[];
  signIn: (email: string, senha: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectOrganization: (id: string) => void;
  selectArea: (id: string) => void;
  refreshOrganizations: (organizationId: string, preferredAreaId?: string) => Promise<void>;
  updateOwnMembership: (
    userId: string,
    organizationId: string,
    membership: { perfil: string; ativo: boolean },
  ) => void;
  retry: () => void;
};
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Sessao | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaContext, setAreaContext] = useState<{ organizationId: string; areas: Area[] } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    me()
      .then((data) => {
        if (active) {
          setSession(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setSession(null);
          setError(
            err instanceof ApiError && err.status === 401
              ? err.code === 'TOKEN_EXPIRADO'
                ? 'Sua sessão expirou. Entre novamente.'
                : null
              : err instanceof Error
                ? err.message
                : 'Falha ao verificar a sessão.',
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const organization =
    session?.organizacoes.find((org) => org.id === orgId) || session?.organizacoes[0] || null;
  const organizationId = organization?.id;
  const availableAreas =
    areaContext?.organizationId === organizationId ? (areaContext?.areas ?? []) : [];
  const area = availableAreas.find((item) => item.id === areaId) || availableAreas[0] || null;

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    areas(organizationId)
      .then((data) => {
        if (active) {
          setAreaContext({ organizationId, areas: data });
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setAreaContext(null);
          setError(err instanceof Error ? err.message : 'Falha ao carregar áreas.');
        }
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  const clearContext = useCallback(() => {
    queryClient.clear();
    setOrgId(null);
    setAreaId(null);
    setAreaContext(null);
  }, [queryClient]);
  useEffect(() => {
    const expired = () => {
      clearContext();
      setSession(null);
      setError('Sua sessão expirou. Entre novamente.');
    };
    window.addEventListener('orbe:session-expired', expired);
    return () => window.removeEventListener('orbe:session-expired', expired);
  }, [clearContext]);
  const signIn = async (email: string, senha: string) => {
    const data = await login(email, senha);
    clearContext();
    setSession(data);
    setError(null);
  };
  const signOut = async () => {
    await logout();
    clearContext();
    setSession(null);
    setError(null);
  };
  const selectOrganization = (id: string) => {
    if (!session?.organizacoes.some((org) => org.id === id)) return;
    queryClient.clear();
    setAreaId(null);
    setAreaContext(null);
    setOrgId(id);
  };
  const selectArea = (id: string) => {
    if (!availableAreas.some((item) => item.id === id)) return;
    queryClient.clear();
    setAreaId(id);
  };
  const refreshOrganizations = async (preferredOrganizationId: string, preferredAreaId?: string) => {
    const updated = await me();
    if (!updated.organizacoes.some((org) => org.id === preferredOrganizationId)) {
      throw new Error('Organização criada, mas o novo acesso ainda não está disponível.');
    }
    queryClient.clear();
    setSession(updated);
    setOrgId(preferredOrganizationId);
    setAreaId(preferredAreaId ?? null);
    setAreaContext(null);
    setError(null);
  };
  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        error,
        organization,
        area,
        availableAreas,
        signIn,
        signOut,
        selectOrganization,
        selectArea,
        refreshOrganizations,
        updateOwnMembership: (userId, organizationId, { perfil, ativo }) => {
          setSession((current) => {
            if (current?.usuario.id !== userId) return current;
            return {
              ...current,
              organizacoes: current.organizacoes.flatMap((org) =>
                org.id !== organizationId ? [org] : ativo ? [{ ...org, perfil }] : [],
              ),
            };
          });
        },
        retry: () => {
          setLoading(true);
          setAttempt((value) => value + 1);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider ausente');
  return value;
}
