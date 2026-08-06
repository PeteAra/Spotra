import { Resend } from "resend";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calendarDateAtNoonUtc,
  utcToWallParts,
} from "@/lib/utils/dates";

type SendResult = { ok: true; id?: string } | { ok: false; error: string };

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://spotra.dev"
  );
}

function fromAddress() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Spotra <onboarding@resend.dev>"
  );
}

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailShell(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe6;color:#1c241c;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3efe6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf8;border:1px solid #d7cebc;border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#6a7264;">
              Spotra · Beta
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#6a7264;">
          Claim a spot, simply · <a href="${siteUrl()}" style="color:#1f6f5b;">spotra.dev</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.info(
      "[email] Skipped (RESEND_API_KEY not set):",
      input.subject,
      "→",
      input.to,
    );
    return { ok: false, error: "Email not configured" };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    },
    input.idempotencyKey
      ? { idempotencyKey: input.idempotencyKey }
      : undefined,
  );

  if (error) {
    console.error("[email] Send failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id };
}

export async function sendWelcomeEmail(input: {
  to: string;
  displayName: string;
}): Promise<SendResult> {
  const name = input.displayName.trim() || "there";
  const workspacesUrl = `${siteUrl()}/workspaces`;
  const subject = "Welcome to Spotra";
  const text = `Hi ${name},

Welcome to Spotra — share open times and let people claim a spot.

Open your workspaces: ${workspacesUrl}

— Spotra`;

  const html = emailShell(
    subject,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;font-weight:600;">Welcome to Spotra</h1>
      <p style="margin:0 0 14px;font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5;color:#1c241c;">
        Hi ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 14px;font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5;color:#1c241c;">
        You’re in. Create a workspace, open time slots, share the link, and let people claim a spot — without the scheduling maze.
      </p>
      <p style="margin:24px 0 0;">
        <a href="${workspacesUrl}" style="display:inline-block;background:#1f6f5b;color:#f7fff9;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;padding:12px 18px;border-radius:12px;">
          Open your workspaces
        </a>
      </p>
    `,
  );

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
    idempotencyKey: `welcome/${input.to.toLowerCase()}`,
  });
}

export async function sendClaimConfirmationEmail(input: {
  to: string;
  displayName: string;
  workspaceTitle: string;
  workspaceSlug: string;
  slotTitle: string;
  startsAt: string;
  endsAt: string;
  timeZoneOffsetMinutes: number;
}): Promise<SendResult> {
  const name = input.displayName.trim() || "there";
  const title = input.slotTitle.trim() || "Time slot";
  const startWall = utcToWallParts(input.startsAt, input.timeZoneOffsetMinutes);
  const endWall = utcToWallParts(input.endsAt, input.timeZoneOffsetMinutes);
  const day = calendarDateAtNoonUtc(startWall.date);
  const [sh, sm] = startWall.time.split(":").map(Number);
  const [eh, em] = endWall.time.split(":").map(Number);
  const startLabel = format(
    new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), sh, sm)),
    "h:mm a",
  );
  const endLabel = format(
    new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), eh, em)),
    "h:mm a",
  );
  const when = `${format(day, "EEEE, MMM d")} · ${startLabel} – ${endLabel}`;
  const workspaceUrl = `${siteUrl()}/workspace/${encodeURIComponent(input.workspaceSlug)}`;
  const subject = `Spot claimed · ${title}`;
  const text = `Hi ${name},

You claimed a spot in ${input.workspaceTitle}.

${title}
${when}

Open the workspace: ${workspaceUrl}

— Spotra`;

  const html = emailShell(
    subject,
    `
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;font-weight:600;">Spot claimed</h1>
      <p style="margin:0 0 14px;font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5;color:#1c241c;">
        Hi ${escapeHtml(name)}, you claimed a spot in <strong>${escapeHtml(input.workspaceTitle)}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f3efe6;border:1px solid #d7cebc;border-radius:16px;">
        <tr>
          <td style="padding:16px 18px;font-family:system-ui,-apple-system,sans-serif;">
            <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6a7264;">Time slot</p>
            <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1c241c;">${escapeHtml(title)}</p>
            <p style="margin:0;font-size:15px;color:#1c241c;">${escapeHtml(when)}</p>
          </td>
        </tr>
      </table>
      <p style="margin:24px 0 0;">
        <a href="${workspaceUrl}" style="display:inline-block;background:#1f6f5b;color:#f7fff9;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:600;padding:12px 18px;border-radius:12px;">
          Open workspace
        </a>
      </p>
    `,
  );

  return sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}

/**
 * Send a welcome email once per account. Safe to call on every authenticated request.
 * Claims the send with welcome_email_sent_at to avoid duplicates.
 */
export async function maybeSendWelcomeEmail(
  supabase: SupabaseClient,
  accountId: string,
): Promise<void> {
  try {
    const claimedAt = new Date().toISOString();
    const { data: claimed, error } = await supabase
      .from("accounts")
      .update({ welcome_email_sent_at: claimedAt })
      .eq("id", accountId)
      .is("welcome_email_sent_at", null)
      .select("email, display_name")
      .maybeSingle();

    if (error || !claimed?.email) return;

    const result = await sendWelcomeEmail({
      to: claimed.email,
      displayName: claimed.display_name ?? "",
    });

    if (!result.ok) {
      // Allow a later request to retry.
      await supabase
        .from("accounts")
        .update({ welcome_email_sent_at: null })
        .eq("id", accountId)
        .eq("welcome_email_sent_at", claimedAt);
    }
  } catch (e) {
    console.error("[email] Welcome send error:", e);
  }
}
