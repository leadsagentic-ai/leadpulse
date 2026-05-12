import { Resend } from 'resend'
import { logger } from '@/lib/logger'

/**
 * Sends a welcome email to a newly registered beta user.
 * No-ops gracefully when RESEND_API_KEY is absent (local dev / CI).
 */
export async function sendWelcomeEmail(
  resendApiKey: string | undefined,
  to: string,
  name: string,
): Promise<void> {
  if (!resendApiKey) {
    logger.info({ to }, 'Welcome email skipped — RESEND_API_KEY not configured')
    return
  }

  const resend = new Resend(resendApiKey)
  const firstName = name.split(' ')[0] ?? name

  const { error } = await resend.emails.send({
    from: 'LeadPulse <hello@leadpulse.ai>',
    to,
    subject: 'Welcome to LeadPulse — you\'re in! 🎉',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to LeadPulse</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;background:#0f172a;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                LeadPulse Intelligence
              </h1>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">AI-powered B2B lead generation</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">
                Hey ${firstName}, welcome aboard! 👋
              </h2>
              <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
                You're one of our first beta users and we're excited to have you. LeadPulse monitors
                Reddit, LinkedIn, Twitter and more to surface high-intent B2B leads for you — automatically.
              </p>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Here's how to get started in 3 steps:
              </p>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:0 0 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="background:#f8fafc;border-radius:8px;border-left:4px solid #6366f1;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:600;">1. Create your first campaign</p>
                          <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
                            Define your ICP and choose which platforms to monitor.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="background:#f8fafc;border-radius:8px;border-left:4px solid #6366f1;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:600;">2. Watch leads appear</p>
                          <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
                            Leads are scored and ranked by intent — you'll see the best ones first.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                           style="background:#f8fafc;border-radius:8px;border-left:4px solid #6366f1;">
                      <tr>
                        <td style="padding:16px 20px;">
                          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:600;">3. Connect your CRM</p>
                          <p style="margin:4px 0 0;color:#64748b;font-size:13px;">
                            Push approved leads straight into HubSpot or Salesforce.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://app.leadpulse.ai/campaigns/new"
                       style="display:inline-block;padding:14px 32px;background:#6366f1;color:#ffffff;
                              font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Create your first campaign →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                LeadPulse Intelligence · You're receiving this because you signed up for beta access.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  })

  if (error) {
    // Non-fatal — log and continue. The user is already created.
    logger.error({ err: error, to }, 'Failed to send welcome email')
  } else {
    logger.info({ to }, 'Welcome email sent')
  }
}
