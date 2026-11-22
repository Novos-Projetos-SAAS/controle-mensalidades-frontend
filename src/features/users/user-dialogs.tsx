'use client';

import { useState, type FormEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createUser, profileInfo, profiles, updateUser, userError } from './users-api';
import type { OrganizationUser, Profile } from './users-api';

const passwordHint =
  'Use de 12 a 128 caracteres, com maiúscula, minúscula, número e caractere especial.';
const createSchema = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome completo.').max(150, 'Use até 150 caracteres.'),
    email: z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido.').max(150)),
    senha: z
      .string()
      .min(12, passwordHint)
      .max(128, passwordHint)
      .regex(/[a-z]/, passwordHint)
      .regex(/[A-Z]/, passwordHint)
      .regex(/\d/, passwordHint)
      .regex(/[^A-Za-z0-9]/, passwordHint),
    confirmarSenha: z.string(),
    perfil: z.enum(profiles),
  })
  .refine(({ senha, confirmarSenha }) => senha === confirmarSenha, {
    path: ['confirmarSenha'],
    message: 'As senhas não coincidem.',
  });

type DialogProps = {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onSaved: (user: OrganizationUser, message: string) => void;
  restoreFocus: () => void;
};

function ProfileOptions() {
  return profiles.map((profile) => (
    <option key={profile} value={profile}>
      {profileInfo[profile].label}
    </option>
  ));
}

function DialogActions({
  pending,
  onClose,
  label,
  disabled,
}: {
  pending: boolean;
  onClose: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
        Cancelar
      </Button>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? 'Salvando...' : label}
      </Button>
    </div>
  );
}

const fields = [
  { name: 'nome', label: 'Nome completo', type: 'text', autoComplete: 'section-novo name' },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'section-novo email' },
  { name: 'senha', label: 'Senha inicial', type: 'password', autoComplete: 'new-password' },
  {
    name: 'confirmarSenha',
    label: 'Confirmar senha',
    type: 'password',
    autoComplete: 'new-password',
  },
] as const;

export function CreateUserDialog({
  organizationId,
  organizationName,
  onClose,
  onSaved,
  restoreFocus,
}: DialogProps) {
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { nome: '', email: '', senha: '', confirmarSenha: '', perfil: 'OPERADOR' },
  });
  const { errors, isSubmitting } = form.formState;
  const profile = useWatch({ control: form.control, name: 'perfil' });
  const submit = form.handleSubmit(async ({ nome, email, senha, perfil }) => {
    form.clearErrors('root');
    try {
      const user = await createUser(organizationId, { nome, email, senha, perfil });
      form.reset();
      onSaved(user, 'Usuário cadastrado com sucesso.');
    } catch (error) {
      form.setError('root', { message: userError(error, 'Não foi possível cadastrar o usuário.') });
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogTitle className="display pr-10 text-3xl">Adicionar usuário</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-slate-600">
          Crie uma conta com senha inicial para a organização {organizationName}.
        </DialogDescription>
        <form noValidate onSubmit={submit} className="mt-5 space-y-4">
          <fieldset disabled={isSubmitting} className="space-y-4">
            {fields.map(({ name, label, type, autoComplete }) => (
              <div key={name}>
                <label htmlFor={name} className="field-label">
                  {label}
                </label>
                <Input
                  id={name}
                  type={type}
                  autoComplete={autoComplete}
                  {...form.register(name)}
                  aria-invalid={!!errors[name]}
                  aria-describedby={
                    errors[name] ? `${name}-erro` : name === 'senha' ? 'senha-regras' : undefined
                  }
                />
                {name === 'senha' && !errors.senha && (
                  <p id="senha-regras" className="mt-1 text-xs text-slate-600">
                    {passwordHint}
                  </p>
                )}
                {errors[name] && (
                  <p id={`${name}-erro`} role="alert" className="mt-1 text-xs text-red-700">
                    {errors[name].message}
                  </p>
                )}
              </div>
            ))}
            <div>
              <label htmlFor="novo-perfil" className="field-label">
                Perfil
              </label>
              <select
                id="novo-perfil"
                className="select-field"
                {...form.register('perfil')}
                aria-describedby="novo-perfil-descricao"
              >
                <ProfileOptions />
              </select>
              <p id="novo-perfil-descricao" className="mt-2 text-sm text-slate-600">
                {profileInfo[profile].description}
              </p>
            </div>
          </fieldset>
          {errors.root && (
            <p role="alert" className="text-sm text-red-700">
              {errors.root.message}
            </p>
          )}
          <DialogActions pending={isSubmitting} onClose={onClose} label="Cadastrar usuário" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UpdateUserDialog({
  organizationId,
  organizationName,
  user,
  action,
  onClose,
  onSaved,
  restoreFocus,
}: DialogProps & { user: OrganizationUser; action: 'profile' | 'status' }) {
  const [profile, setProfile] = useState(user.perfil);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const changingProfile = action === 'profile';
  const verb = user.ativo ? 'Desativar' : 'Reativar';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || (changingProfile && profile === user.perfil)) return;
    setPending(true);
    setError('');
    try {
      const updated = await updateUser(
        organizationId,
        user.id,
        changingProfile ? { perfil: profile } : { ativo: !user.ativo },
      );
      onSaved(
        updated,
        changingProfile
          ? 'Perfil atualizado.'
          : user.ativo
            ? 'Acesso desativado.'
            : 'Acesso reativado.',
      );
    } catch (error) {
      setError(userError(error, 'Não foi possível atualizar o acesso.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        className="max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogTitle className="display pr-10 text-3xl">
          {changingProfile ? 'Alterar perfil' : `${verb} acesso`}
        </DialogTitle>
        <DialogDescription className="mt-2 break-words text-sm text-slate-600">
          {user.nome} · {organizationName}
        </DialogDescription>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {changingProfile ? (
            <>
              <label className="block">
                <span className="field-label">Novo perfil</span>
                <select
                  className="select-field"
                  value={profile}
                  disabled={pending}
                  onChange={(event) => setProfile(event.target.value as Profile)}
                  aria-describedby="perfis-descricao"
                >
                  <ProfileOptions />
                </select>
              </label>
              <dl
                id="perfis-descricao"
                className="space-y-2 rounded-xl bg-teal-50 p-4 text-sm text-teal-950"
              >
                {profiles.map((item) => (
                  <div key={item}>
                    <dt className="font-semibold">{profileInfo[item].label}</dt>
                    <dd>{profileInfo[item].description}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-700">
              {user.ativo
                ? 'Este usuário perderá o acesso à organização. Você poderá reativá-lo depois.'
                : 'Este usuário voltará a acessar a organização com o perfil atual.'}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogActions
            pending={pending}
            onClose={onClose}
            label={changingProfile ? 'Salvar perfil' : `${verb} acesso`}
            disabled={changingProfile && profile === user.perfil}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
