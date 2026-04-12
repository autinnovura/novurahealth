import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

const FROM_EMAIL = 'NovuraHealth <hello@novurahealth.com>'

export async function sendWelcomeEmail(email: string, name: string) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Welcome to NovuraHealth, ${name}!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 32px;">🌿</span>
          <h1 style="color: #2D5A3D; font-size: 24px; margin: 8px 0 0;">NovuraHealth</h1>
        </div>
        <p style="color: #1E1E1C; font-size: 16px; line-height: 1.6;">Hey ${name},</p>
        <p style="color: #1E1E1C; font-size: 16px; line-height: 1.6;">
          Welcome to NovuraHealth! We're glad you're here. Nova, your AI wellness coach, is ready to help you
          navigate your GLP-1 journey with personalized guidance, nutrition tips, and daily support.
        </p>
        <p style="color: #1E1E1C; font-size: 16px; line-height: 1.6;">Here's what you can do right now:</p>
        <ul style="color: #1E1E1C; font-size: 16px; line-height: 1.8;">
          <li>Chat with Nova about your medication, side effects, or nutrition</li>
          <li>Log your weight and track progress on your dashboard</li>
          <li>Review your personalized tapering plan when you're ready</li>
        </ul>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://novurahealth.com/dashboard" style="background: #2D5A3D; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Go to Dashboard
          </a>
        </div>
        <p style="color: #8B8B83; font-size: 13px; text-align: center; margin-top: 40px;">
          You're receiving this because you signed up for NovuraHealth.<br/>
          Questions? Just reply to this email.
        </p>
      </div>
    `,
  })
}

export async function sendWeeklyDigest(
  email: string,
  name: string,
  stats: {
    currentWeight?: string
    weightChange?: string
    logsThisWeek?: number
    streak?: number
  }
) {
  const { currentWeight, weightChange, logsThisWeek, streak } = stats

  return resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `${name}, here's your weekly progress`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 32px;">🌿</span>
          <h1 style="color: #2D5A3D; font-size: 24px; margin: 8px 0 0;">Your Weekly Check-In</h1>
        </div>
        <p style="color: #1E1E1C; font-size: 16px; line-height: 1.6;">Hey ${name}, here's how your week went:</p>
        <div style="background: #F5F5F2; border-radius: 12px; padding: 20px; margin: 24px 0;">
          ${currentWeight ? `<p style="color: #1E1E1C; font-size: 15px; margin: 8px 0;"><strong>Current weight:</strong> ${currentWeight} lbs</p>` : ''}
          ${weightChange ? `<p style="color: #2D5A3D; font-size: 15px; margin: 8px 0;"><strong>Change this week:</strong> ${weightChange}</p>` : ''}
          ${logsThisWeek !== undefined ? `<p style="color: #1E1E1C; font-size: 15px; margin: 8px 0;"><strong>Days logged:</strong> ${logsThisWeek}/7</p>` : ''}
          ${streak ? `<p style="color: #1E1E1C; font-size: 15px; margin: 8px 0;"><strong>Streak:</strong> ${streak} days</p>` : ''}
        </div>
        <p style="color: #1E1E1C; font-size: 16px; line-height: 1.6;">
          Keep it up! Every small step counts. Nova is always here if you need guidance or just want to talk through your week.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://novurahealth.com/dashboard" style="background: #2D5A3D; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View Full Dashboard
          </a>
        </div>
        <p style="color: #8B8B83; font-size: 13px; text-align: center; margin-top: 40px;">
          Sent every Sunday by NovuraHealth.<br/>
          Reply to this email anytime.
        </p>
      </div>
    `,
  })
}
