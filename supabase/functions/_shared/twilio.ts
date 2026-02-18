// ORTHO-040: Twilio SMS Client
// Shared Twilio configuration for SMS fallback

export interface SmsOptions {
  to: string;
  body: string;
}

export interface SmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Normalizes a German phone number to E.164 format.
 * "0511 34833-0"  -> "+4951134830"
 * "01511234567"   -> "+491511234567"
 * "+491511234567" -> "+491511234567" (unchanged)
 */
function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\/]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+49' + cleaned.slice(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+49' + cleaned;
  }
  return cleaned;
}

/**
 * Partially masks a phone number for logging.
 * "+491511234567" -> "+49151***4567"
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return '***';
  return phone.slice(0, 6) + '***' + phone.slice(-4);
}

export async function sendSms(options: SmsOptions): Promise<SmsResult> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    console.error('[sendSms] Twilio credentials not configured');
    return {
      success: false,
      error: 'SMS-Konfiguration fehlt. Twilio-Zugangsdaten nicht gesetzt.',
    };
  }

  const toNormalized = normalizePhoneNumber(options.to);

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toNormalized,
        From: fromNumber,
        Body: options.body,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[sendSms] Twilio API error:', data);
      return {
        success: false,
        error: data.message || `Twilio error: ${data.code}`,
      };
    }

    console.log('[sendSms] SMS sent successfully:', data.sid);
    return {
      success: true,
      messageSid: data.sid,
    };
  } catch (error) {
    console.error('[sendSms] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
