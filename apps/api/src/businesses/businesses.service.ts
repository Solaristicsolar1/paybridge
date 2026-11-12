
import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { randomBytes } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import {
    UpdateBusinessPayoutDto,
} from './dto/update-business-payout.dto';

@Injectable()
export class BusinessesService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // ==========================================
    // UPDATE BUSINESS BASE PAYOUT ADDRESS
    // ==========================================

    async updateBasePayoutAddress(
        businessId: string,
        dto: UpdateBusinessPayoutDto,
    ) {
        const business = await this.prisma.business.findUnique({
            where: {
                id: businessId,
            },
            select: {
                id: true,
            },
        });

        if (!business) {
            throw new NotFoundException('Business not found');
        }

        return this.prisma.business.update({
            where: {
                id: businessId,
            },
            data: {
                basePayoutAddress: dto.basePayoutAddress,
            },
            select: {
                id: true,
                name: true,
                defaultCurrency: true,
                basePayoutAddress: true,
                updatedAt: true,
            },
        });
    }

    // Generate a unique business slug
    private generateSlug(name: string): string {
        const baseSlug = name
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 60) || 'business';

        const uniqueSuffix = randomBytes(6).toString('hex');

        return `${baseSlug}-${uniqueSuffix}`;
    }

    // Create a business and automatically assign its creator as OWNER
    async createBusiness(
        userId: string,
        dto: CreateBusinessDto,
    ) {
        const name = dto.name.trim();

        const slug = this.generateSlug(name);

        return this.prisma.$transaction(async (tx) => {
            // Create the business
            const business = await tx.business.create({
                data: {
                    name,
                    slug,
                    defaultCurrency: dto.defaultCurrency ?? 'USD',
                    createdById: userId,
                },
            });

            // Automatically make the creator the business owner
            const membership = await tx.businessMember.create({
                data: {
                    businessId: business.id,
                    userId,
                    role: 'OWNER',
                    status: 'ACTIVE',
                    joinedAt: new Date(),
                },
            });

            return {
                business,
                membership: {
                    id: membership.id,
                    role: membership.role,
                    status: membership.status,
                    joinedAt: membership.joinedAt,
                },
            };
        });
    }

    // Retrieve all businesses belonging to the authenticated user
    async getMyBusinesses(userId: string) {
        return this.prisma.business.findMany({
            where: {
                members: {
                    some: {
                        userId,
                        status: 'ACTIVE',
                    },
                },
            },

            include: {
                members: {
                    where: {
                        userId,
                    },
                    select: {
                        role: true,
                        status: true,
                        joinedAt: true,
                    },
                },
            },

            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // Retrieve one business, provided the user has active membership
    async getBusiness(
        businessId: string,
        userId: string,
    ) {
        const business = await this.prisma.business.findFirst({
            where: {
                id: businessId,
                members: {
                    some: {
                        userId,
                        status: 'ACTIVE',
                    },
                },
            },
        });

        if (!business) {
            throw new NotFoundException('Business not found');
        }

        return business;
    }
}
