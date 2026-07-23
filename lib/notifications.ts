// Future email support (Resend) — not wired in MVP.
// When ready: send claim confirmations, cancel notices, and reminders from here.

export async function sendEmailPlaceholder(input: {
  to: string;
  subject: string;
  html: string;
}) {
  void input;
  return { ok: false as const, error: "Email not configured in MVP" };
}
