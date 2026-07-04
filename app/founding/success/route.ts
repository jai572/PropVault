import { NextResponse } from 'next/server'

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're in — PropVault</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f7f9fc;
      color: #1a202c;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: #1a3c5e;
      padding: 16px 24px;
      text-align: center;
    }
    .header .logo { font-size: 1.5rem; font-weight: 800; color: #fff; }
    .header .logo span { color: #f59e0b; }
    .main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }
    .card {
      background: #fff;
      border: 1px solid #cbd5e0;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(26,60,94,0.1);
    }
    .tick {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #f0fff4;
      border: 3px solid #38a169;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 2rem;
    }
    .card h1 { font-size: 1.75rem; font-weight: 800; color: #1a3c5e; margin-bottom: 12px; }
    .card p { font-size: 1rem; color: #4a5568; line-height: 1.7; margin-bottom: 10px; }
    .highlight {
      background: #e8f1fa;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 20px 0;
      font-size: 0.95rem;
      color: #1a3c5e;
    }
    .highlight strong { font-weight: 700; }
    .footer-note { font-size: 0.8rem; color: #718096; margin-top: 24px; }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">Prop<span>Vault</span></div>
  </header>
  <main class="main">
    <div class="card">
      <div class="tick">&#10003;</div>
      <h1>You&rsquo;re in.</h1>
      <p>Welcome to PropVault. Your founding member place is confirmed.</p>
      <div class="highlight">
        <strong>Free until 1 October 2026.</strong><br>
        Your card has been saved but no payment has been taken.<br>
        Billing of <strong>&pound;10/month</strong> begins on 1 October 2026.<br>
        Cancel any time before then &mdash; nothing is charged.
      </div>
      <p>Check your email &mdash; a link to set your password has been sent to the address you provided. Click it to access your PropVault account and start adding your properties.</p>
      <p class="footer-note">Didn&rsquo;t receive the email? Check your spam folder, or reply to your Stripe receipt for help.</p>
    </div>
  </main>
</body>
</html>`

export async function GET() {
  return new NextResponse(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
