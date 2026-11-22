import { describe, expect, it } from 'vitest';

import { isValidCpf, maskCpf, maskPhone } from './document-mask';

describe('CPF', () => {
  it('aplica máscara progressiva, preserva zeros e limita 11 dígitos', () => {
    expect(maskCpf('0')).toBe('0');
    expect(maskCpf('001234')).toBe('001.234');
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('529.982.247-25')).toBe('529.982.247-25');
    expect(maskCpf('5299822472500')).toBe('529.982.247-25');
  });
  it('valida dígitos verificadores, não apenas o tamanho', () => {
    for (const cpf of ['52998224725', '529.982.247-25', '11144477735', '98765432100']) {
      expect(isValidCpf(cpf)).toBe(true);
    }
    for (const cpf of ['', '123', '52998224726', '11111111111', '00000000000', '12345678901']) {
      expect(isValidCpf(cpf)).toBe(false);
    }
  });
});

describe('telefone', () => {
  it('aplica máscaras nacional e DDI 55 sem mudar os dígitos', () => {
    expect(maskPhone('11999998888')).toBe('(11) 99999-8888');
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
    expect(maskPhone('5511999998888')).toBe('+55 (11) 99999-8888');
    expect(maskPhone('11999998888')).toBe(maskPhone('(11) 99999-8888'));
    expect(maskPhone('5511999998888').replace(/\D/g, '')).toBe('5511999998888');
  });
});
