
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
    imports: [
        DatabaseModule,
        MailModule,

        PassportModule.register({
            defaultStrategy: 'jwt',
        }),

        JwtModule.registerAsync({
            useFactory: () => {
                const secret = process.env.JWT_ACCESS_SECRET;

                if (!secret) {
                    throw new Error(
                        'JWT_ACCESS_SECRET is not configured',
                    );
                }

                return {
                    secret,
                    signOptions: {
                        expiresIn: 900,
                    },
                };
            },
        }),

        // Rate limiting configuration.
        ThrottlerModule.forRoot([
            {
                name: 'default',
                ttl: 60_000,
                limit: 10,
            },
        ]),
    ],

    controllers: [
        AuthController,
    ],

    providers: [
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
    ],

    exports: [
        AuthService,
        JwtAuthGuard,
        PassportModule,
        ThrottlerModule,
    ],
})
export class AuthModule { }
