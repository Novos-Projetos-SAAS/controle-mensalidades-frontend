'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Layers3 } from 'lucide-react';
import { useSession } from '@/features/auth/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
});
type Values = z.infer<typeof schema>;
export default function LoginPage() {
  const router = useRouter();
  const { session, loading, signIn, error: sessionError, retry } = useSession();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (session) router.replace('/');
  }, [session, router]);
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.06fr_.94fr]">
      <section className="relative hidden overflow-hidden bg-[#123c46] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-10 subtle-grid" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-white/15">
            <Layers3 size={23} aria-hidden="true" />
          </div>
          <span className="display text-3xl">orbe</span>
        </div>
        <div className="relative my-auto max-w-xl">
          <p className="mb-6 text-xs font-bold tracking-[.25em] text-teal-200 uppercase">
            Gestão com perspectiva
          </p>
          <h1 className="display text-6xl leading-[1.08] xl:text-7xl">
            Mais clareza para cuidar da operação.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-teal-100">
            Clientes, profissionais e áreas de negócio reunidos em um ambiente simples de usar.
          </p>
          <div className="mt-12 flex items-center gap-3 border-t border-white/20 pt-6 text-sm text-teal-100">
            <span className="h-px w-12 bg-[#e2ad76]" />
            Organização em cada detalhe.
          </div>
        </div>
        <div className="relative text-xs text-teal-200">Orbe Gestão · Ambiente seguro</div>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[#f6f9f8] px-5 py-10 sm:px-8">
        <div className="w-full max-w-[430px]">
          <div className="mb-12 flex items-center gap-2 text-teal-800 lg:hidden">
            <Layers3 size={29} />
            <strong className="display text-3xl">orbe</strong>
          </div>
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold tracking-[.18em] text-teal-700 uppercase">
              Bem-vindo de volta
            </p>
            <h2 className="display text-4xl text-slate-900 sm:text-5xl">Acesse sua conta</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Use o e-mail e a senha cadastrados para continuar.
            </p>
          </div>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError('');
              try {
                await signIn(values.email, values.senha);
                router.replace('/');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
              }
            })}
            className="space-y-5"
          >
            <label className="block">
              <span className="field-label">E-mail</span>
              <Input
                type="email"
                autoComplete="username"
                placeholder="voce@empresa.com.br"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <span role="alert" className="mt-1 block text-xs text-red-700">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label className="block">
              <span className="field-label">Senha</span>
              <span className="relative block">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  className="pr-12"
                  {...register('senha')}
                  aria-invalid={!!errors.senha}
                />
                <button
                  type="button"
                  className="absolute right-1 top-0 grid size-11 place-items-center rounded-lg text-slate-500 hover:text-teal-700"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
              {errors.senha && (
                <span role="alert" className="mt-1 block text-xs text-red-700">
                  {errors.senha.message}
                </span>
              )}
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            {sessionError && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                {sessionError}{' '}
                <button type="button" className="underline" onClick={retry}>
                  Tentar novamente
                </button>
              </div>
            )}
            <Button type="submit" disabled={isSubmitting || loading} className="w-full">
              {isSubmitting ? 'Entrando...' : 'Entrar na plataforma'}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </form>
          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <LockKeyhole size={14} aria-hidden="true" /> Sua sessão é protegida.
          </p>
        </div>
      </section>
    </main>
  );
}
