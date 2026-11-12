
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PrismaService } from '../database/prisma.service';

import {
    BUSINESS_ROLES_KEY,
    BusinessRole,
} from './business-roles.decorator';

import type { JwtPayload } from '../auth/strategies/jwt.strategy';

interface BusinessRequest extends Request {
    user?: JwtPayload;

    businessMembership?: {
        id: string;
        businessId: string;
        userId: string;
        role: string;
        status: string;
    };
}

@Injectable()
export class BusinessAccessGuard implements CanActivate {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const request = context
            .switchToHttp()
            .getRequest<BusinessRequest>();

        const userId = request.user?.sub;

        // Extract and validate the business ID
        const rawBusinessId = request.params?.businessId;

        const businessId =
            typeof rawBusinessId === 'string'
                ? rawBusinessId
                : undefined;

        if (!userId) {
            throw new UnauthorizedException(
                'Authentication required',
            );
        }

        if (!businessId) {
            throw new ForbiddenException(
                'A valid business ID is required',
            );
        }

        // Verify active business membership
        const membership =
            await this.prisma.businessMember.findFirst({
                where: {
                    userId,
                    businessId,
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    userId: true,
                    businessId: true,
                    role: true,
                    status: true,
                },
            });

        if (!membership) {
            throw new ForbiddenException(
                'You do not have access to this business',
            );
        }

        // Retrieve roles required by the endpoint
        const requiredRoles =
            this.reflector.getAllAndOverride<BusinessRole[]>(
                BUSINESS_ROLES_KEY,
                [
                    context.getHandler(),
                    context.getClass(),
                ],
            );

        // Enforce role-based permissions
        if (
            requiredRoles &&
            !requiredRoles.includes(
                membership.role as BusinessRole,
            )
        ) {
            throw new ForbiddenException(
                'You do not have sufficient permissions',
            );
        }

        // Make verified membership available to the controller
        request.businessMembership = membership;

        return true;
    }
}
