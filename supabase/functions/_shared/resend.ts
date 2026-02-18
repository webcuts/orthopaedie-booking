// ORTHO-007: Resend E-Mail Client
// Shared Resend configuration

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const FROM_EMAIL = 'Orthopädie Königstraße <onboarding@resend.dev>';
// Für Produktion: 'Orthopädie Königstraße <termine@orthopaedie-koenigstrasse.de>'

export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');

  if (!apiKey) {
    console.error('[sendEmail] RESEND_API_KEY not configured');
    return {
      success: false,
      error: 'E-Mail-Konfiguration fehlt. RESEND_API_KEY nicht gesetzt.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[sendEmail] Resend API error:', data);
      return {
        success: false,
        error: data.message || 'Fehler beim E-Mail-Versand',
      };
    }

    console.log('[sendEmail] Email sent successfully:', data.id);
    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error('[sendEmail] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
