
import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../database/prisma.service';

export interface JwtPayload {
    sub: string;
    sid: string;
    email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly prisma: PrismaService,
    ) {
        const secret = process.env.JWT_ACCESS_SECRET;

        if (!secret) {
            throw new Error(
                'JWT_ACCESS_SECRET is not configured',
            );
        }

        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request) => request?.cookies?.pb_access ?? null,
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: JwtPayload): Promise<JwtPayload> {
        if (!payload.sub || !payload.sid || !payload.email) {
            throw new UnauthorizedException(
                'Invalid access token',
            );
        }

        const validSession =
            await this.prisma.authSession.findFirst({
                where: {
                    id: payload.sid,
                    userId: payload.sub,
                    revokedAt: null,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                select: {
                    id: true,
                    user: {
                        select: {
                            emailVerifiedAt: true,
                        },
                    },
                },
            });

        if (
            !validSession ||
            !validSession.user.emailVerifiedAt
        ) {
            throw new UnauthorizedException(
                'Session expired, revoked or email not verified',
            );
        }

        return payload;
    }
}
