const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/** Máscara visual: os valores enviados à API continuam contendo somente dígitos. */
export function maskCpf(value: string): string {
  const cpf = digits(value, 11);
  if (cpf.length <= 3) return cpf;
  if (cpf.length <= 6) return cpf.slice(0, 3) + '.' + cpf.slice(3);
  if (cpf.length <= 9) return cpf.slice(0, 3) + '.' + cpf.slice(3, 6) + '.' + cpf.slice(6);
  return cpf.slice(0, 3) + '.' + cpf.slice(3, 6) + '.' + cpf.slice(6, 9) + '-' + cpf.slice(9);
}

/** Apenas valida os dígitos verificadores; não consulta Receita Federal nem prova titularidade. */
export function isValidCpf(value: string): boolean {
  const cpf = digits(value, 11);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  // Rejeita entrada com mais de 11 dígitos, que seria truncada pela máscara.
  if (value.replace(/\D/g, '').length !== 11) return false;

  for (let size = 9; size <= 10; size += 1) {
    let sum = 0;
    for (let index = 0; index < size; index += 1) {
      sum += Number(cpf[index]) * (size + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    const checkDigit = remainder === 10 ? 0 : remainder;
    if (Number(cpf[size]) !== checkDigit) return false;
  }
  return true;
}

function maskNationalPhone(phone: string): string {
  if (!phone) return '';
  if (phone.length <= 2) return '(' + phone;
  const area = phone.slice(0, 2);
  const number = phone.slice(2);
  const prefixLength = phone.length === 11 ? 5 : 4;
  if (number.length <= prefixLength) return '(' + area + ') ' + number;
  return '(' + area + ') ' + number.slice(0, prefixLength) + '-' + number.slice(prefixLength);
}

/** Telefones nacionais (10/11 dígitos) recebem máscara DDD; +55 e outros DDI são preservados. */
export function maskPhone(value: string): string {
  const phone = digits(value, 15);
  if (!phone) return '';
  if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
    return '+55 ' + maskNationalPhone(phone.slice(2));
  }
  if (phone.length <= 11) return maskNationalPhone(phone);
  return '+' + phone;
}
