
import {
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';

import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: Transporter | null = null;

    private getTransporter(): Transporter {
        if (this.transporter) {
            return this.transporter;
        }

        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT ?? 587);
        const from = process.env.SMTP_FROM;

        if (!host || !from || !Number.isInteger(port) || port <= 0) {
            throw new ServiceUnavailableException(
                'Email service is not configured',
            );
        }

        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: process.env.SMTP_SECURE === 'true',
            ...(user && pass
                ? { auth: { user, pass } }
                : {}),
        });

        return this.transporter;
    }

    private escapeHtml(value: string): string {
        return value.replace(/[&<>"']/g, (character) => {
            const entities: Record<string, string> = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            };

            return entities[character] ?? character;
        });
    }


    async sendEmailVerification(data: {
        email: string;
        displayName: string | null;
        verificationUrl: string;
        expiresAt: Date;
    }): Promise<void> {
        const from = process.env.SMTP_FROM;

        if (!from) {
            throw new ServiceUnavailableException(
                'SMTP_FROM is not configured',
            );
        }

        const displayName = this.escapeHtml(
            data.displayName || 'there',
        );

        const verificationUrl = this.escapeHtml(
            data.verificationUrl,
        );

        const expires = data.expiresAt.toUTCString();

        await this.getTransporter().sendMail({
            from,
            to: data.email,
            subject: 'Verify your email address | PayBridge',

            text: `
Hello ${data.displayName || 'there'},

Welcome to PayBridge!

Please verify your email address by visiting the link below:

${data.verificationUrl}

This verification link expires on ${expires}.

If you did not create a PayBridge account, you can ignore this email.

PayBridge Team
        `.trim(),

            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verify your email | PayBridge</title>
</head>

<body style="margin:0;padding:30px;background:#f4f6fb;font-family:Arial,sans-serif;">

    <div style="max-width:560px;margin:auto;background:#ffffff;padding:36px;border-radius:12px;">

        <h1 style="color:#172554;">PayBridge</h1>

        <h2 style="color:#111827;">Verify your email address</h2>

        <p>Hello ${displayName},</p>

        <p>
            Welcome to PayBridge! We're glad to have you here.
        </p>

        <p>
            Please verify your email address to activate
            your PayBridge account.
        </p>

        <div style="margin:30px 0;">
            <a
                href="${verificationUrl}"
                style="background:#3730a3;color:white;padding:14px 24px;
                border-radius:7px;text-decoration:none;font-weight:bold;"
            >
                Verify Email Address
            </a>
        </div>

        <p style="color:#6b7280;font-size:13px;">
            This verification link expires on ${expires}.
        </p>

        <p style="color:#6b7280;font-size:13px;">
            If you did not create a PayBridge account,
            you can safely ignore this email.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

        <p style="color:#9ca3af;font-size:12px;">
            PayBridge. Business payments made simpler.
        </p>

    </div>
</body>
</html>
        `,
        });
    }


    async sendPasswordResetEmail(data: {
        email: string;
        displayName: string | null;
        resetUrl: string;
        expiresAt: Date;
    }): Promise<void> {
        const from = process.env.SMTP_FROM;

        if (!from) {
            throw new ServiceUnavailableException(
                'SMTP_FROM is not configured',
            );
        }

        const displayName = this.escapeHtml(
            data.displayName || 'there',
        );

        const resetUrl = this.escapeHtml(data.resetUrl);
        const expires = data.expiresAt.toUTCString();

        await this.getTransporter().sendMail({
            from,
            to: data.email,
            subject: 'Reset your PayBridge password',

            text: `
Hello ${data.displayName || 'there'},

We received a request to reset your PayBridge password.

Use the link below to create a new password:

${data.resetUrl}

This link expires on ${expires} and can only be used once.

You do not need your former password to complete this process.

If you did not request a password reset, you can ignore this email.

PayBridge Team
        `.trim(),

            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Reset Password | PayBridge</title>
</head>

<body style="margin:0;padding:30px;background:#f4f6fb;font-family:Arial,sans-serif;">

    <div style="max-width:560px;margin:auto;background:#ffffff;padding:36px;border-radius:12px;">

        <h1 style="color:#172554;">PayBridge</h1>

        <h2 style="color:#111827;">Reset your password</h2>

        <p>Hello ${displayName},</p>

        <p>
            We received a request to reset your PayBridge password.
        </p>

        <p>
            Click the button below to create a new password.
            You do not need to enter your former password.
        </p>

        <div style="margin:30px 0;">
            <a
                href="${resetUrl}"
                style="background:#3730a3;color:white;padding:14px 24px;
                border-radius:7px;text-decoration:none;font-weight:bold;"
            >
                Reset My Password
            </a>
        </div>

        <p style="color:#6b7280;font-size:13px;">
            This link expires on ${expires}.
        </p>

        <p style="color:#6b7280;font-size:13px;">
            If you did not request this change, you can safely ignore this email.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

        <p style="color:#9ca3af;font-size:12px;">
            PayBridge. Business payments made simpler.
        </p>

    </div>
</body>
</html>
        `,
        });
    }


    async sendBusinessInvitation(data: {
        email: string;
        businessName: string;
        inviterName: string;
        role: string;
        invitationUrl: string;
        expiresAt: Date;
    }): Promise<void> {
        const from = process.env.SMTP_FROM;

        if (!from) {
            throw new ServiceUnavailableException(
                'SMTP_FROM is not configured',
            );
        }

        const businessName = this.escapeHtml(data.businessName);
        const inviterName = this.escapeHtml(data.inviterName);
        const role = this.escapeHtml(data.role);

        const expires = data.expiresAt.toUTCString();

        await this.getTransporter().sendMail({
            from,
            to: data.email,
            subject: `Invitation to join ${data.businessName} on PayBridge`,

            text: `
Hello,

${data.inviterName} has invited you to join
${data.businessName} on PayBridge.

Your assigned role is ${data.role}.

Accept your invitation using this link:

${data.invitationUrl}

This invitation expires on ${expires}.

If you were not expecting this invitation,
you can safely ignore this email.

PayBridge Team
      `.trim(),

            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PayBridge Invitation</title>
</head>
<body style="margin:0;padding:30px;background:#f4f6fb;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:auto;background:#ffffff;padding:36px;border-radius:12px;">
    <h1 style="color:#172554;">PayBridge</h1>

    <h2 style="color:#111827;">You have been invited!</h2>

    <p>Hello,</p>

    <p>
      <strong>${inviterName}</strong> has invited you to join
      <strong>${businessName}</strong> on PayBridge.
    </p>

    <p>Your assigned role: <strong>${role}</strong></p>

    <div style="margin:30px 0;">
      <a
        href="${this.escapeHtml(data.invitationUrl)}"
        style="background:#3730a3;color:white;padding:14px 24px;
        border-radius:7px;text-decoration:none;font-weight:bold;"
      >
        Accept Invitation
      </a>
    </div>

    <p style="color:#6b7280;font-size:13px;">
      This invitation expires on ${expires}.
    </p>

    <p style="color:#6b7280;font-size:13px;">
      If you were not expecting this invitation, you can ignore this email.
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">

    <p style="color:#9ca3af;font-size:12px;">
      PayBridge. Business payments made simpler.
    </p>
  </div>
</body>
</html>
      `,
        });
    }
}
