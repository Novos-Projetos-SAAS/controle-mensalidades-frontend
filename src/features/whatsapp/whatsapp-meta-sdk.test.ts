import { describe, expect, it } from 'vitest';
import { parseMetaSignupMessage } from './whatsapp-meta-sdk';

describe('Meta Embedded Signup session messages', () => {
  const finish = JSON.stringify({
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH',
    data: { waba_id: 'waba-1', phone_number_id: 'phone-1', business_id: 'business-1' },
  });

  it('accepts a documented completion message from an HTTPS Meta origin', () => {
    expect(parseMetaSignupMessage('https://www.facebook.com', false, finish)).toEqual({
      event: 'FINISH',
      data: {
        waba_id: 'waba-1',
        phone_number_id: 'phone-1',
        business_id: 'business-1',
      },
    });
  });

  it('rejects spoofed origins, the parent window, malformed data and unknown events', () => {
    expect(parseMetaSignupMessage('https://facebook.com.attacker.test', false, finish)).toBeNull();
    expect(parseMetaSignupMessage('http://www.facebook.com', false, finish)).toBeNull();
    expect(parseMetaSignupMessage('https://www.facebook.com', true, finish)).toBeNull();
    expect(parseMetaSignupMessage('https://www.facebook.com', false, '{')).toBeNull();
    expect(
      parseMetaSignupMessage(
        'https://www.facebook.com',
        false,
        JSON.stringify({ type: 'OTHER', event: 'FINISH', data: {} }),
      ),
    ).toBeNull();
  });

  it('recognizes the official coexistence completion event', () => {
    expect(
      parseMetaSignupMessage(
        'https://business.facebook.com',
        false,
        JSON.stringify({
          type: 'WA_EMBEDDED_SIGNUP',
          event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
          data: { waba_id: 'waba-1' },
        }),
      )?.event,
    ).toBe('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING');
  });
});
