import type { Bindings } from "@/env";
import { fetchWithRetry } from "@/lib/http";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(env: Bindings, msg: EmailMessage): Promise<void> {
  if (env.RESEND_API_KEY) {
    const res = await fetchWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: `Open AdScan <${env.ADMIN_EMAIL}>`,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? `<pre>${escapeHtml(msg.text)}</pre>`,
      }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
    return;
  }
  // Fallback: MailChannels (free for CF Workers)
  const res = await fetchWithRetry("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: { email: env.ADMIN_EMAIL, name: "Open AdScan" },
      subject: msg.subject,
      content: [
        { type: "text/plain", value: msg.text },
        { type: "text/html", value: msg.html ?? `<pre>${escapeHtml(msg.text)}</pre>` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`MailChannels failed: ${res.status} ${await res.text()}`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
