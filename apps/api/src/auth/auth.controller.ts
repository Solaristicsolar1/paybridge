
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService } from './auth.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { JwtPayload } from './strategies/jwt.strategy';

interface AuthenticatedRequest extends Request {
    user: JwtPayload;
}

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    // ==========================================
    // COOKIE CONFIGURATION
    // ==========================================

    private cookieOptions() {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            path: '/',
        };
    }

    private setAuthCookies(
        response: Response,
        accessToken: string,
        refreshToken: string,
    ): void {
        response.cookie('pb_access', accessToken, {
            ...this.cookieOptions(),
            maxAge: 15 * 60 * 1000,
        });

        response.cookie('pb_refresh', refreshToken, {
            ...this.cookieOptions(),
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });
    }

    private clearAuthCookies(response: Response): void {
        response.clearCookie(
            'pb_access',
            this.cookieOptions(),
        );

        response.clearCookie(
            'pb_refresh',
            this.cookieOptions(),
        );
    }

    private metadata(request: Request) {
        const userAgent = request.get('user-agent');
        const ipAddress = request.ip;

        return {
            ...(userAgent !== undefined && { userAgent }),
            ...(ipAddress !== undefined && { ipAddress }),
        };
    }

    // ==========================================
    // REGISTER
    // ==========================================

    @Post('register')
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 5,
            ttl: 60_000,
        },
    })
    async register(
        @Body() dto: RegisterDto,
    ) {
        return this.authService.register(dto);
    }

    // ==========================================
    // VERIFY EMAIL: DISPLAY CONFIRMATION PAGE
    // ==========================================

    @Get('verify-email')
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 10,
            ttl: 60_000,
        },
    })
    showVerificationPage(
        @Query('token') token: string,
        @Res() response: Response,
    ) {
        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(token)
        ) {
            return response
                .status(HttpStatus.BAD_REQUEST)
                .type('html')
                .send(`
                    <!DOCTYPE html>
                    <html>
                    <body style="font-family:Arial;padding:40px;text-align:center;">
                        <h2>Invalid verification link</h2>
                        <p>Please request a new verification email.</p>
                    </body>
                    </html>
                `);
        }

        const apiUrl = process.env.API_PUBLIC_URL;

        if (!apiUrl) {
            return response
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .type('html')
                .send('<h2>Verification service is unavailable.</h2>');
        }

        const confirmUrl =
            `${apiUrl.replace(/\/+$/, '')}/auth/verify-email/confirm?token=${encodeURIComponent(token)}`;

        return response
            .status(HttpStatus.OK)
            .type('html')
            .send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>Verify Email | PayBridge</title>
                </head>

                <body style="margin:0;background:#f4f6fb;font-family:Arial,sans-serif;padding:40px 20px;">

                    <div style="max-width:460px;margin:60px auto;background:#fff;padding:40px;border-radius:12px;text-align:center;">

                        <h1 style="color:#172554;">PayBridge</h1>

                        <h2 style="color:#111827;">Verify your email</h2>

                        <p style="color:#6b7280;line-height:1.7;">
                            Please confirm that you want to verify
                            your email address.
                        </p>

                        <form method="POST" action="${confirmUrl}">
                            <button
                                type="submit"
                                style="background:#3730a3;color:white;border:0;padding:15px 28px;border-radius:7px;font-size:15px;font-weight:bold;cursor:pointer;"
                            >
                                Confirm Email Address
                            </button>
                        </form>

                        <p style="margin-top:30px;color:#9ca3af;font-size:12px;">
                            PayBridge. Business payments made simpler.
                        </p>

                    </div>

                </body>
                </html>
            `);
    }

    // ==========================================
    // VERIFY EMAIL: CONSUME TOKEN
    // ==========================================

    @Post('verify-email/confirm')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 5,
            ttl: 60_000,
        },
    })
    async confirmEmail(
        @Query('token') token: string,
    ) {
        return this.authService.verifyEmail(token);
    }

    // ==========================================
    // RESEND VERIFICATION
    // ==========================================

    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 3,
            ttl: 60_000,
        },
    })
    async resendVerification(
        @Body() dto: ResendVerificationDto,
    ) {
        return this.authService.resendVerificationEmail(
            dto.email,
        );
    }

    // ==========================================
    // FORGOT PASSWORD
    // ==========================================

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 3,
            ttl: 60_000,
        },
    })
    async forgotPassword(
        @Body() dto: ForgotPasswordDto,
    ) {
        return this.authService.requestPasswordReset(dto);
    }

    // ==========================================
    // DISPLAY PASSWORD RESET FORM
    // ==========================================

    @Get('reset-password')
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 10,
            ttl: 60_000,
        },
    })
    showPasswordResetPage(
        @Query('token') token: string,
        @Res() response: Response,
    ) {
        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(token)
        ) {
            return response
                .status(HttpStatus.BAD_REQUEST)
                .type('html')
                .send('<h2>Invalid password reset link.</h2>');
        }

        return response
            .status(HttpStatus.OK)
            .type('html')
            .send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>Reset Password | PayBridge</title>
                </head>

                <body style="margin:0;padding:30px;background:#f4f6fb;font-family:Arial,sans-serif;">

                    <div style="max-width:460px;margin:60px auto;background:white;padding:36px;border-radius:12px;">

                        <h1 style="color:#172554;">PayBridge</h1>

                        <h2 style="color:#111827;">Create a new password</h2>

                        <p style="color:#6b7280;">
                            Enter your new password below.
                            You do not need your former password.
                        </p>

                        <form method="POST" action="/v1/auth/reset-password/confirm">

                            <input
                                type="hidden"
                                name="token"
                                value="${token}"
                            >

                            <label for="newPassword">
                                New password
                            </label>

                            <input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                minlength="12"
                                maxlength="128"
                                autocomplete="new-password"
                                required
                                style="display:block;width:100%;box-sizing:border-box;padding:13px;margin:10px 0 20px;border:1px solid #d1d5db;border-radius:7px;"
                            >

                            <label for="confirmPassword">
                                Confirm new password
                            </label>

                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                minlength="12"
                                maxlength="128"
                                autocomplete="new-password"
                                required
                                style="display:block;width:100%;box-sizing:border-box;padding:13px;margin:10px 0 25px;border:1px solid #d1d5db;border-radius:7px;"
                            >

                            <button
                                type="submit"
                                style="width:100%;background:#3730a3;color:white;border:0;padding:15px;border-radius:7px;font-weight:bold;cursor:pointer;"
                            >
                                Reset Password
                            </button>

                        </form>

                        <p style="color:#9ca3af;font-size:12px;margin-top:25px;">
                            PayBridge. Business payments made simpler.
                        </p>

                    </div>

                </body>
                </html>
            `);
    }

    // ==========================================
    // CONFIRM PASSWORD RESET
    // ==========================================

    @Post('reset-password/confirm')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 5,
            ttl: 60_000,
        },
    })
    async confirmPasswordReset(
        @Body() dto: ResetPasswordDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.authService.resetPassword(dto);

        // Clear any existing authentication cookies.
        this.clearAuthCookies(response);

        // Do not automatically log the user in.
        return result;
    }

    // ==========================================
    // LOGIN
    // ==========================================

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 5,
            ttl: 60_000,
        },
    })
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() dto: LoginDto,
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.authService.login(
            dto,
            this.metadata(request),
        );

        this.setAuthCookies(
            response,
            result.accessToken,
            result.refreshToken,
        );

        return {
            message: 'Login successful',
            user: result.user,
        };
    }

    // ==========================================
    // REFRESH
    // ==========================================

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 10,
            ttl: 60_000,
        },
    })
    async refresh(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.authService.refresh(
            request.cookies?.pb_refresh,
        );

        this.setAuthCookies(
            response,
            result.accessToken,
            result.refreshToken,
        );

        return {
            message: 'Session refreshed successfully',
            user: result.user,
        };
    }

    // ==========================================
    // LOGOUT
    // ==========================================

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ) {
        await this.authService.logout(
            request.cookies?.pb_refresh,
        );

        this.clearAuthCookies(response);

        return {
            message: 'Logged out successfully',
        };
    }

    // ==========================================
    // CURRENT USER
    // ==========================================

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async me(
        @Req() request: AuthenticatedRequest,
    ) {
        return this.authService.getMe(request.user.sub);
    }
}
