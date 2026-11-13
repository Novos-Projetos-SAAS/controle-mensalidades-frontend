export const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR').format(
        new Date(value.length === 10 ? `${value}T12:00:00` : value),
      )
    : '—';
export const formatCpf = (value?: string | null) =>
  value?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') || '—';
export const initials = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
