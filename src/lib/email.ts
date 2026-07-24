// Thin wrapper over the Resend REST API. Uses fetch so there is no extra
// dependency. No-ops (without throwing) when RESEND_API_KEY is missing, so the
// app runs fine in environments where email is not configured yet.

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

type SendEmailResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL);
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;

  if (!apiKey || !from) {
    return { sent: false, skipped: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, error: `Resend ${response.status}: ${detail}` };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
