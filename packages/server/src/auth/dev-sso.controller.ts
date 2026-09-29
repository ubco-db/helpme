import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { NonProductionGuard } from '../guards/non-production.guard';
import { AuthService } from './auth.service';
import { CourseService } from 'course/course.service';
import { ConfigService } from '@nestjs/config';

/**
 * Development-only SSO mock controller.
 *
 * In production, Shibboleth authentication is handled by an upstream reverse proxy
 * (e.g. Apache/Nginx with mod_shib) which intercepts requests to `/api/v1/auth/shibboleth/:oid`,
 * authenticates the user, and then proxies the request to our backend with `x-trust-auth-*` headers.
 *
 * Locally, there is no such reverse proxy, so SSO can't be tested. This controller provides a
 * mock Shibboleth IdP that:
 *   1. Shows a simple login form where the developer can enter any email/name
 *   2. Submits the form, which sets the `x-trust-auth-*` headers and calls the real
 *      `shibbolethAuthCallback` method from AuthService
 *
 * This controller is guarded by `NonProductionGuard`, so it will never be accessible in production.
 *
 * Usage:
 *   Instead of linking to `/api/v1/auth/shibboleth/:oid`, link to `/api/v1/dev-sso/login/:oid`
 *   in development. The controller will render a mock login form, then call the real SSO callback.
 */
@UseGuards(NonProductionGuard)
@Controller('dev-sso')
export class DevSsoController {
  constructor(
    private authService: AuthService,
    private courseService: CourseService,
    private configService: ConfigService,
  ) {}

  /**
   * Renders a mock Shibboleth IdP login page.
   * Pre-populates with sensible defaults so devs can just click "Login".
   */
  @Get('login/:oid')
  async mockSsoLoginPage(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) organizationId: number,
    @Query('redirect') redirect?: string,
  ): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock SSO Login (Dev Only)</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e0e0e0;
    }
    .container {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #e94560, #c23152);
      color: white;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #e0e0e0, #a0a0a0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 14px;
      color: #888;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #aaa;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    input[type="email"], input[type="text"] {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      color: #e0e0e0;
      font-size: 15px;
      margin-bottom: 16px;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    input:focus {
      border-color: #e94560;
      box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.2);
    }
    input::placeholder { color: #555; }
    button[type="submit"] {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #e94560, #c23152);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      margin-top: 8px;
    }
    button[type="submit"]:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 25px rgba(233, 69, 96, 0.35);
    }
    button[type="submit"]:active { transform: translateY(0); }
    .info-box {
      margin-top: 20px;
      padding: 14px;
      background: rgba(255, 206, 86, 0.08);
      border: 1px solid rgba(255, 206, 86, 0.2);
      border-radius: 10px;
      font-size: 12px;
      color: #bbb;
      line-height: 1.6;
    }
    .info-box strong { color: #ffce56; }
    .row {
      display: flex;
      gap: 12px;
    }
    .row > div { flex: 1; }

    /* Recent logins selector */
    .recent-logins {
      margin-bottom: 20px;
    }
    .recent-logins label {
      margin-bottom: 8px;
    }
    .recent-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 240px;
      overflow-y: auto;
    }
    .recent-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s;
      width: 100%;
      text-align: left;
      color: #ccc;
      font-size: 13px;
      font-family: inherit;
    }
    .recent-item:hover {
      background: rgba(233, 69, 96, 0.12);
      border-color: rgba(233, 69, 96, 0.3);
    }
    .recent-item.active {
      background: rgba(233, 69, 96, 0.15);
      border-color: rgba(233, 69, 96, 0.5);
    }
    .recent-item .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e94560, #c23152);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      color: white;
      flex-shrink: 0;
    }
    .recent-item .details {
      flex: 1;
      min-width: 0;
    }
    .recent-item .name {
      font-weight: 600;
      color: #e0e0e0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .recent-item .email-text {
      font-size: 11px;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .clear-btn {
      margin-top: 8px;
      padding: 6px 12px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #666;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
      width: auto;
      font-family: inherit;
    }
    .clear-btn:hover {
      border-color: rgba(233, 69, 96, 0.4);
      color: #e94560;
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 20px 0;
    }
    .no-recent {
      font-size: 12px;
      color: #555;
      font-style: italic;
      padding: 8px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">⚠ Dev Only</div>
    <h1>Mock SSO Login</h1>
    <p class="subtitle">
      This simulates Shibboleth SSO authentication for local development.
      Select a recent login or enter any identity to proceed.
    </p>

    <div class="recent-logins" id="recentLoginsSection">
      <label>Recent Logins</label>
      <div class="recent-list" id="recentList">
        <div class="no-recent">No recent logins saved yet.</div>
      </div>
      <button type="button" class="clear-btn" id="clearHistoryBtn" style="display:none;"
        onclick="clearHistory()">Clear History</button>
    </div>

    <div class="divider"></div>

    <form method="POST" id="ssoForm"
      action="/api/v1/dev-sso/callback/${organizationId}${redirect ? '?redirect=' + encodeURIComponent(redirect) : ''}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" value="studentOne@ubc.ca" required placeholder="user@ubc.ca" />

      <div class="row">
        <div>
          <label for="givenName">First Name</label>
          <input type="text" id="givenName" name="givenName" value="studentOne" required placeholder="John" />
        </div>
        <div>
          <label for="lastName">Last Name</label>
          <input type="text" id="lastName" name="lastName" value="studentOne" required placeholder="Doe" />
        </div>
      </div>

      <button type="submit">Sign In with Mock SSO</button>
    </form>

    <div class="info-box">
      <strong>How this works:</strong> This form simulates what a Shibboleth IdP would do.
      It sets the <code>x-trust-auth-*</code> headers that the real SSO proxy would provide,
      then calls the same auth callback as production.
      <br/><br/>
      <strong>Org ID:</strong> ${organizationId}
      ${redirect ? '<br/><strong>Redirect:</strong> ' + redirect : ''}
    </div>
  </div>

  <script src="/api/v1/dev-sso/script.js"></script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Serves the JavaScript for the mock SSO login page.
   * This is done as a separate endpoint to avoid Content Security Policy (CSP) issues with inline scripts.
   */
  @Get('script.js')
  mockSsoScript(@Res() res: Response): void {
    const js = `
    const STORAGE_KEY = 'dev_sso_login_history';
    const MAX_HISTORY = 10;

    const emailInput = document.getElementById('email');
    const givenNameInput = document.getElementById('givenName');
    const lastNameInput = document.getElementById('lastName');
    const form = document.getElementById('ssoForm');
    const recentList = document.getElementById('recentList');
    const clearBtn = document.getElementById('clearHistoryBtn');

    function getHistory() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      } catch (e) { return []; }
    }

    function saveHistory(history) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }

    function addToHistory(entry) {
      let history = getHistory();
      // Remove duplicate (same email)
      history = history.filter(h => h.email !== entry.email);
      // Prepend the new entry
      history.unshift(entry);
      // Keep only the last MAX_HISTORY entries
      history = history.slice(0, MAX_HISTORY);
      saveHistory(history);
    }

    window.clearHistory = function() {
      localStorage.removeItem(STORAGE_KEY);
      renderRecentLogins();
    }

    window.selectLogin = function(entry) {
      emailInput.value = entry.email;
      givenNameInput.value = entry.givenName;
      lastNameInput.value = entry.lastName;
      // Update active state
      document.querySelectorAll('.recent-item').forEach(el => el.classList.remove('active'));
      const activeEl = document.querySelector('[data-email="' + CSS.escape(entry.email) + '"]');
      if (activeEl) activeEl.classList.add('active');
    }

    function getInitials(givenName, lastName) {
      return ((givenName || '')[0] || '').toUpperCase() + ((lastName || '')[0] || '').toUpperCase();
    }

    function renderRecentLogins() {
      const history = getHistory();
      if (history.length === 0) {
        recentList.innerHTML = '<div class="no-recent">No recent logins saved yet.</div>';
        clearBtn.style.display = 'none';
        return;
      }

      clearBtn.style.display = 'inline-block';
      recentList.innerHTML = history.map(function(entry, i) {
        var initials = getInitials(entry.givenName, entry.lastName);
        var isActive = entry.email === emailInput.value;
        return '<button type="button" class="recent-item' + (isActive ? ' active' : '') + '" '
          + 'data-index="' + i + '">'
          + '<div class="avatar">' + initials + '</div>'
          + '<div class="details">'
          + '<div class="name">' + escapeHtml(entry.givenName) + ' ' + escapeHtml(entry.lastName) + '</div>'
          + '<div class="email-text">' + escapeHtml(entry.email) + '</div>'
          + '</div>'
          + '</button>';
      }).join('');
    }

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Event delegation for recent login clicks
    recentList.addEventListener('click', function(e) {
      var btn = e.target.closest('.recent-item');
      if (!btn) return;
      var index = parseInt(btn.getAttribute('data-index'), 10);
      var history = getHistory();
      if (history[index]) {
        window.selectLogin(history[index]);
      }
    });

    // On page load: populate form from most recent entry
    (function init() {
      const history = getHistory();
      if (history.length > 0) {
        const last = history[0];
        emailInput.value = last.email;
        givenNameInput.value = last.givenName;
        lastNameInput.value = last.lastName;
      }
      renderRecentLogins();
    })();

    // Before form submit: save current credentials to history
    form.addEventListener('submit', function(e) {
      e.preventDefault(); // Pause the submit to guarantee save finishes
      const entry = {
        email: emailInput.value.trim(),
        givenName: givenNameInput.value.trim(),
        lastName: lastNameInput.value.trim(),
      };
      if (entry.email && entry.givenName && entry.lastName) {
        addToHistory(entry);
      }
      form.submit(); // Now actually submit
    });
    `;
    res.setHeader('Content-Type', 'application/javascript');
    res.send(js);
  }

  /**
   * Handles the mock SSO form submission (POST from HTML form).
   * Sets the x-trust-auth-* headers on the request object (simulating
   * what the upstream Shibboleth proxy would do) and then delegates
   * to the real AuthService.shibbolethAuthCallback.
   */
  @Post('callback/:oid')
  async mockSsoCallbackPost(
    @Req() req: Request,
    @Res() res: Response,
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() body: { email?: string; givenName?: string; lastName?: string },
    @Query('redirect') redirect?: string,
  ): Promise<void> {
    const { email, givenName, lastName } = body;

    if (!email || !givenName || !lastName) {
      res.redirect(`/api/v1/dev-sso/login/${organizationId}`);
      return;
    }

    // Simulate the x-trust-auth headers that the real SSO proxy sets
    req.headers['x-trust-auth-mail'] = email;
    req.headers['x-trust-auth-givenname'] = givenName;
    req.headers['x-trust-auth-lastname'] = lastName;

    await this.authService.shibbolethAuthCallback(
      req,
      res,
      organizationId,
      this.courseService,
      undefined,
      {
        redirect,
        cookieOptions: {
          httpOnly: true,
          secure: this.configService
            .get<string>('DOMAIN')
            .startsWith('https://'),
        },
      },
    );
  }

  /**
   * Handles the mock SSO callback via GET (for direct URL access).
   */
  @Get('callback/:oid')
  async mockSsoCallbackGet(
    @Req() req: Request,
    @Res() res: Response,
    @Param('oid', ParseIntPipe) organizationId: number,
    @Query('email') email?: string,
    @Query('givenName') givenName?: string,
    @Query('lastName') lastName?: string,
    @Query('redirect') redirect?: string,
  ): Promise<void> {
    if (!email || !givenName || !lastName) {
      res.redirect(`/api/v1/dev-sso/login/${organizationId}`);
      return;
    }

    // Simulate the x-trust-auth headers that the real SSO proxy sets
    req.headers['x-trust-auth-mail'] = email;
    req.headers['x-trust-auth-givenname'] = givenName;
    req.headers['x-trust-auth-lastname'] = lastName;

    await this.authService.shibbolethAuthCallback(
      req,
      res,
      organizationId,
      this.courseService,
      undefined,
      {
        redirect,
        cookieOptions: {
          httpOnly: true,
          secure: this.configService
            .get<string>('DOMAIN')
            .startsWith('https://'),
        },
      },
    );
  }
}
