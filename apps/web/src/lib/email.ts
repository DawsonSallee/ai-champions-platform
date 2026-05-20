/**
 * Email abstraction.
 *
 * Backends:
 *  - "log"   (dev)  — prints to stdout, returns ok
 *  - "smtp"  (any)  — nodemailer SMTP, e.g. corporate relay
 *  - "graph" (prod) — Microsoft Graph send-as via the app registration
 *
 * Driven by EMAIL_BACKEND env var. Preferred: "graph" — no per-email cost
 * and replies land in a real M365 mailbox.
 */
export type EmailMessage = {
  to: string[];
  subject: string;
  html: string;
  cc?: string[];
};

export interface EmailClient {
  send(msg: EmailMessage): Promise<{ ok: boolean; messageId?: string; error?: string }>;
}

class LogEmail implements EmailClient {
  async send(msg: EmailMessage) {
    // eslint-disable-next-line no-console
    console.log(
      `\n📧 Email [stub]\n  to: ${msg.to.join(", ")}\n  cc: ${
        msg.cc?.join(", ") ?? "—"
      }\n  subject: ${msg.subject}\n  html: ${msg.html.slice(0, 200)}...\n`,
    );
    return { ok: true, messageId: "log-" + Date.now() };
  }
}

class SmtpEmail implements EmailClient {
  private transporter: unknown | null = null;

  private async ensure() {
    if (this.transporter) return this.transporter;
    const nodemailer = await import("nodemailer");
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
    });
    return this.transporter;
  }

  async send(msg: EmailMessage) {
    const t = (await this.ensure()) as {
      sendMail: (opts: unknown) => Promise<{ messageId: string }>;
    };
    try {
      const info = await t.sendMail({
        from: process.env.SMTP_FROM ?? "noreply@example.test",
        to: msg.to.join(", "),
        cc: msg.cc?.join(", "),
        subject: msg.subject,
        html: msg.html,
      });
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class GraphEmail implements EmailClient {
  /**
   * Sends mail as the app registration's service account using the
   * Microsoft Graph /sendMail endpoint. Requires Mail.Send application
   * permission with admin consent.
   */
  async send(msg: EmailMessage) {
    const tenantId = process.env.AUTH_ENTRA_TENANT_ID;
    const clientId = process.env.AUTH_ENTRA_CLIENT_ID;
    const clientSecret = process.env.AUTH_ENTRA_CLIENT_SECRET;
    const sender = process.env.GRAPH_SEND_AS;
    if (!tenantId || !clientId || !clientSecret || !sender) {
      return { ok: false, error: "Graph send-as not configured" };
    }

    // Acquire app-only token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );
    if (!tokenRes.ok) {
      return { ok: false, error: `Token error ${tokenRes.status}` };
    }
    const token = (await tokenRes.json()) as { access_token: string };

    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
        sender,
      )}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: msg.subject,
            body: { contentType: "HTML", content: msg.html },
            toRecipients: msg.to.map((e) => ({ emailAddress: { address: e } })),
            ccRecipients: (msg.cc ?? []).map((e) => ({
              emailAddress: { address: e },
            })),
          },
          saveToSentItems: true,
        }),
      },
    );
    if (!sendRes.ok) {
      return { ok: false, error: `Graph error ${sendRes.status}` };
    }
    return { ok: true };
  }
}

let _client: EmailClient | null = null;
export function getEmail(): EmailClient {
  if (_client) return _client;
  const b = process.env.EMAIL_BACKEND ?? "log";
  if (b === "graph") _client = new GraphEmail();
  else if (b === "smtp") _client = new SmtpEmail();
  else _client = new LogEmail();
  return _client;
}
