
import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';

import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

import { JwtPayload } from './strategies/jwt.strategy';

interface SessionMetadata {
    userAgent?: string;
    ipAddress?: string;
}

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        displayName: string | null;
    };
}

@Injectable()
export class AuthService {
    private readonly refreshDays: number;
    private readonly verificationMinutes: number;
    private readonly resendCooldownSeconds: number;

    private readonly passwordResetMinutes: number;
    private readonly passwordResetCooldownSeconds: number;

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
    ) {
        this.refreshDays = Number(
            process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 30,
        );

        this.verificationMinutes = Number(
            process.env.EMAIL_VERIFICATION_EXPIRES_IN_MINUTES ?? 30,
        );

        this.resendCooldownSeconds = Number(
            process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS ?? 60,
        );

        this.passwordResetMinutes = Number(
            process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES ?? 30,
        );

        this.passwordResetCooldownSeconds = Number(
            process.env.PASSWORD_RESET_COOLDOWN_SECONDS ?? 60,
        );

        if (
            !Number.isInteger(this.refreshDays) ||
            this.refreshDays < 1 ||
            this.refreshDays > 90
        ) {
            throw new Error('Invalid JWT refresh token lifetime');
        }

        if (
            !Number.isInteger(this.verificationMinutes) ||
            this.verificationMinutes < 5 ||
            this.verificationMinutes > 1440
        ) {
            throw new Error('Invalid email verification lifetime');
        }

        if (
            !Number.isInteger(this.resendCooldownSeconds) ||
            this.resendCooldownSeconds < 30 ||
            this.resendCooldownSeconds > 3600
        ) {
            throw new Error('Invalid email verification resend cooldown');
        }

        if (
            !Number.isInteger(this.passwordResetMinutes) ||
            this.passwordResetMinutes < 5 ||
            this.passwordResetMinutes > 60
        ) {
            throw new Error('Invalid password reset lifetime');
        }

        if (
            !Number.isInteger(this.passwordResetCooldownSeconds) ||
            this.passwordResetCooldownSeconds < 30 ||
            this.passwordResetCooldownSeconds > 3600
        ) {
            throw new Error('Invalid password reset cooldown');
        }
    }

    // ==========================================
    // TOKEN HELPERS
    // ==========================================

    private hashToken(token: string): string {
        return createHash('sha256')
            .update(token)
            .digest('hex');
    }

    private generateSecureToken(): string {
        return randomBytes(32).toString('hex');
    }

    private generateRefreshToken(): string {
        return randomBytes(32).toString('base64url');
    }

    private refreshExpiry(): Date {
        return new Date(
            Date.now() + this.refreshDays * 24 * 60 * 60 * 1000,
        );
    }

    private verificationExpiry(): Date {
        return new Date(
            Date.now() + this.verificationMinutes * 60 * 1000,
        );
    }

    private passwordResetExpiry(): Date {
        return new Date(
            Date.now() + this.passwordResetMinutes * 60 * 1000,
        );
    }

    private getApiPublicUrl(): string {
        const url = process.env.API_PUBLIC_URL;

        if (!url) {
            throw new Error('API_PUBLIC_URL is not configured');
        }

        return url.replace(/\/+$/, '');
    }

    // ==========================================
    // JWT ACCESS TOKEN
    // ==========================================

    private async createAccessToken(
        userId: string,
        sessionId: string,
        email: string,
    ): Promise<string> {
        const payload: JwtPayload = {
            sub: userId,
            sid: sessionId,
            email,
        };

        return this.jwtService.signAsync(payload);
    }

    // ==========================================
    // SESSION CREATION
    // ==========================================

    private async createSession(
        user: {
            id: string;
            email: string;
            displayName: string | null;
        },
        metadata: SessionMetadata,
    ): Promise<AuthTokens> {
        const refreshToken = this.generateRefreshToken();

        const session = await this.prisma.authSession.create({
            data: {
                userId: user.id,
                tokenHash: this.hashToken(refreshToken),
                expiresAt: this.refreshExpiry(),
                userAgent: metadata.userAgent?.slice(0, 500) ?? null,
                ipAddress: metadata.ipAddress?.slice(0, 64) ?? null,
            },
        });

        const accessToken = await this.createAccessToken(
            user.id,
            session.id,
            user.email,
        );

        return {
            accessToken,
            refreshToken,
            user,
        };
    }

    // ==========================================
    // REGISTRATION
    // ==========================================

    async register(dto: RegisterDto) {
        const email = dto.email.trim().toLowerCase();

        const passwordHash = await argon2.hash(dto.password, {
            type: argon2.argon2id,
        });

        const verificationToken = this.generateSecureToken();
        const verificationTokenHash = this.hashToken(verificationToken);
        const expiresAt = this.verificationExpiry();

        let user;

        try {
            user = await this.prisma.user.create({
                data: {
                    email,
                    passwordHash,
                    displayName: dto.displayName?.trim() || null,

                    emailVerificationTokenHash: verificationTokenHash,
                    emailVerificationExpiresAt: expiresAt,
                    emailVerificationSentAt: new Date(),
                },
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                },
            });
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002'
            ) {
                throw new ConflictException(
                    'An account with this email already exists',
                );
            }

            throw error;
        }

        const verificationUrl =
            `${this.getApiPublicUrl()}/auth/verify-email?token=${verificationToken}`;

        await this.mailService.sendEmailVerification({
            email: user.email,
            displayName: user.displayName,
            verificationUrl,
            expiresAt,
        });

        // Registration does not create an authenticated session.
        return {
            message: 'Account created. Please verify your email address.',
            user,
            emailVerificationRequired: true,
        };
    }

    // ==========================================
    // EMAIL VERIFICATION
    // ==========================================

    async verifyEmail(token: string) {
        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(token)
        ) {
            throw new BadRequestException(
                'Invalid email verification token',
            );
        }

        const tokenHash = this.hashToken(token);
        const now = new Date();

        // Atomic update prevents a token from being consumed twice.
        const result = await this.prisma.user.updateMany({
            where: {
                emailVerificationTokenHash: tokenHash,
                emailVerifiedAt: null,
                emailVerificationExpiresAt: {
                    gt: now,
                },
            },
            data: {
                emailVerifiedAt: now,
                emailVerificationTokenHash: null,
                emailVerificationExpiresAt: null,
            },
        });

        if (result.count !== 1) {
            throw new BadRequestException(
                'Verification link is invalid, expired or already used',
            );
        }

        return {
            message: 'Email address verified successfully. You can now log in.',
        };
    }

    // ==========================================
    // RESEND VERIFICATION EMAIL
    // ==========================================

    async resendVerificationEmail(emailInput: string) {
        const email = emailInput.trim().toLowerCase();

        const user = await this.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                displayName: true,
                emailVerifiedAt: true,
                emailVerificationSentAt: true,
            },
        });

        const genericResponse = {
            message:
                'If the account requires verification, an email will be sent when eligible.',
        };

        // Avoid revealing whether an email address has an account.
        if (!user || user.emailVerifiedAt) {
            return genericResponse;
        }

        const now = new Date();

        if (
            user.emailVerificationSentAt &&
            now.getTime() - user.emailVerificationSentAt.getTime() <
            this.resendCooldownSeconds * 1000
        ) {
            return genericResponse;
        }

        const verificationToken = this.generateSecureToken();
        const verificationTokenHash = this.hashToken(verificationToken);
        const expiresAt = this.verificationExpiry();

        // Recheck cooldown and verification status atomically.
        const update = await this.prisma.user.updateMany({
            where: {
                id: user.id,
                emailVerifiedAt: null,
                OR: [
                    { emailVerificationSentAt: null },
                    {
                        emailVerificationSentAt: {
                            lte: new Date(
                                now.getTime() -
                                this.resendCooldownSeconds * 1000,
                            ),
                        },
                    },
                ],
            },
            data: {
                emailVerificationTokenHash: verificationTokenHash,
                emailVerificationExpiresAt: expiresAt,
                emailVerificationSentAt: now,
            },
        });

        if (update.count !== 1) {
            return genericResponse;
        }

        const verificationUrl =
            `${this.getApiPublicUrl()}/auth/verify-email?token=${verificationToken}`;

        await this.mailService.sendEmailVerification({
            email: user.email,
            displayName: user.displayName,
            verificationUrl,
            expiresAt,
        });

        return genericResponse;
    }

    // ==========================================
    // FORGOT PASSWORD
    // ==========================================

    async requestPasswordReset(dto: ForgotPasswordDto) {
        const email = dto.email.trim().toLowerCase();

        const genericResponse = {
            message:
                'If an account exists with this email, password reset instructions will be sent.',
        };

        const user = await this.prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                displayName: true,
                passwordResetRequestedAt: true,
            },
        });

        // Never reveal whether an account exists.
        if (!user) {
            return genericResponse;
        }

        const now = new Date();

        const cooldownThreshold = new Date(
            now.getTime() -
            this.passwordResetCooldownSeconds * 1000,
        );

        const resetToken = this.generateSecureToken();
        const resetTokenHash = this.hashToken(resetToken);
        const expiresAt = this.passwordResetExpiry();

        // Atomically enforce the password reset cooldown.
        const update = await this.prisma.user.updateMany({
            where: {
                id: user.id,
                OR: [
                    {
                        passwordResetRequestedAt: null,
                    },
                    {
                        passwordResetRequestedAt: {
                            lte: cooldownThreshold,
                        },
                    },
                ],
            },
            data: {
                passwordResetTokenHash: resetTokenHash,
                passwordResetExpiresAt: expiresAt,
                passwordResetRequestedAt: now,
            },
        });

        if (update.count !== 1) {
            return genericResponse;
        }

        const resetUrl =
            `${this.getApiPublicUrl()}/auth/reset-password?token=${resetToken}`;

        await this.mailService.sendPasswordResetEmail({
            email: user.email,
            displayName: user.displayName,
            resetUrl,
            expiresAt,
        });

        return genericResponse;
    }

    // ==========================================
    // RESET PASSWORD
    // ==========================================


    async resetPassword(dto: ResetPasswordDto) {
        if (
            typeof dto.token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(dto.token)
        ) {
            throw new BadRequestException(
                'Invalid or expired password reset link',
            );
        }

        // Ensure both new password fields match.
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException(
                'Passwords do not match',
            );
        }

        const tokenHash = this.hashToken(dto.token);
        const now = new Date();

        const user = await this.prisma.user.findFirst({
            where: {
                passwordResetTokenHash: tokenHash,
                passwordResetExpiresAt: {
                    gt: now,
                },
            },
            select: {
                id: true,
            },
        });

        if (!user) {
            throw new BadRequestException(
                'Invalid or expired password reset link',
            );
        }

        const passwordHash = await argon2.hash(
            dto.newPassword,
            {
                type: argon2.argon2id,
            },
        );

        // Update the password, consume the token and revoke sessions
        // in one database transaction.
        await this.prisma.$transaction(async (tx) => {
            const consumed = await tx.user.updateMany({
                where: {
                    id: user.id,
                    passwordResetTokenHash: tokenHash,
                    passwordResetExpiresAt: {
                        gt: now,
                    },
                },
                data: {
                    passwordHash,
                    passwordResetTokenHash: null,
                    passwordResetExpiresAt: null,
                    passwordResetRequestedAt: null,
                },
            });

            if (consumed.count !== 1) {
                throw new BadRequestException(
                    'Invalid or expired password reset link',
                );
            }

            // Revoke all active sessions belonging to this user.
            await tx.authSession.updateMany({
                where: {
                    userId: user.id,
                    revokedAt: null,
                },
                data: {
                    revokedAt: now,
                },
            });
        });

        return {
            message:
                'Your password has been reset successfully. Please log in with your new password.',
        };
    }

    // ==========================================
    // LOGIN
    // ==========================================

    async login(
        dto: LoginDto,
        metadata: SessionMetadata,
    ): Promise<AuthTokens> {
        const email = dto.email.trim().toLowerCase();

        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user?.passwordHash) {
            throw new UnauthorizedException(
                'Invalid email or password',
            );
        }

        const passwordValid = await argon2.verify(
            user.passwordHash,
            dto.password,
        );

        if (!passwordValid) {
            throw new UnauthorizedException(
                'Invalid email or password',
            );
        }

        if (!user.emailVerifiedAt) {
            throw new UnauthorizedException(
                'Please verify your email address before logging in',
            );
        }

        return this.createSession(
            {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
            },
            metadata,
        );
    }

    // ==========================================
    // REFRESH TOKEN ROTATION
    // ==========================================

    async refresh(
        refreshToken: string | undefined,
    ): Promise<AuthTokens> {
        if (!refreshToken) {
            throw new UnauthorizedException(
                'Refresh token is missing',
            );
        }

        const tokenHash = this.hashToken(refreshToken);
        const now = new Date();

        const session = await this.prisma.authSession.findUnique({
            where: { tokenHash },
            include: { user: true },
        });

        if (
            !session ||
            session.revokedAt ||
            session.expiresAt <= now ||
            !session.user.passwordHash ||
            !session.user.emailVerifiedAt
        ) {
            throw new UnauthorizedException(
                'Invalid or expired session',
            );
        }

        const newRefreshToken = this.generateRefreshToken();
        const newTokenHash = this.hashToken(newRefreshToken);

        const rotation = await this.prisma.authSession.updateMany({
            where: {
                id: session.id,
                tokenHash,
                revokedAt: null,
                expiresAt: { gt: now },
            },
            data: {
                tokenHash: newTokenHash,
                expiresAt: this.refreshExpiry(),
                lastUsedAt: now,
            },
        });

        if (rotation.count !== 1) {
            throw new UnauthorizedException(
                'Session has already been refreshed or revoked',
            );
        }

        const accessToken = await this.createAccessToken(
            session.user.id,
            session.id,
            session.user.email,
        );

        return {
            accessToken,
            refreshToken: newRefreshToken,
            user: {
                id: session.user.id,
                email: session.user.email,
                displayName: session.user.displayName,
            },
        };
    }

    // ==========================================
    // LOGOUT
    // ==========================================

    async logout(
        refreshToken: string | undefined,
    ): Promise<void> {
        if (!refreshToken) {
            return;
        }

        await this.prisma.authSession.updateMany({
            where: {
                tokenHash: this.hashToken(refreshToken),
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }

    // ==========================================
    // CURRENT USER
    // ==========================================

    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                displayName: true,
                emailVerifiedAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException(
                'User account not found',
            );
        }

        return user;
    }

    // ==========================================
    // SESSION VALIDATION
    // ==========================================

    async validateSession(
        sessionId: string,
        userId: string,
    ): Promise<boolean> {
        const session = await this.prisma.authSession.findFirst({
            where: {
                id: sessionId,
                userId,
                revokedAt: null,
                expiresAt: { gt: new Date() },
                user: {
                    emailVerifiedAt: { not: null },
                },
            },
            select: { id: true },
        });

        return Boolean(session);
    }
}
