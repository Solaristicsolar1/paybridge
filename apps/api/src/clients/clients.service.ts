import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Injectable()
export class ClientsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    // CREATE CLIENT
    async createClient(
        businessId: string,
        dto: CreateClientDto,
    ) {
        return this.prisma.client.create({
            data: {
                businessId,
                name: dto.name,

                ...(dto.email !== undefined && {
                    email: dto.email,
                }),

                ...(dto.phone !== undefined && {
                    phone: dto.phone,
                }),

                ...(dto.companyName !== undefined && {
                    companyName: dto.companyName,
                }),

                ...(dto.billingAddress !== undefined && {
                    billingAddress: dto.billingAddress,
                }),

                ...(dto.notes !== undefined && {
                    notes: dto.notes,
                }),
            },
        });
    }
    // LIST CLIENTS
    async getClients(
        businessId: string,
        query: ListClientsDto,
    ) {
        const page = query.page;
        const limit = query.limit;
        const skip = (page - 1) * limit;

        const search = query.search?.trim();

        const where = {
            businessId,

            ...(search && {
                OR: [
                    {
                        name: {
                            contains: search,
                            mode: 'insensitive' as const,
                        },
                    },
                    {
                        email: {
                            contains: search,
                            mode: 'insensitive' as const,
                        },
                    },
                    {
                        companyName: {
                            contains: search,
                            mode: 'insensitive' as const,
                        },
                    },
                    {
                        phone: {
                            contains: search,
                        },
                    },
                ],
            }),
        };

        const [clients, total] = await Promise.all([
            this.prisma.client.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    _count: {
                        select: {
                            invoices: true,
                        },
                    },
                },
            }),

            this.prisma.client.count({
                where,
            }),
        ]);

        return {
            data: clients,

            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPreviousPage: page > 1,
            },
        };
    }

    // GET SINGLE CLIENT
    async getClient(
        businessId: string,
        clientId: string,
    ) {
        const client = await this.prisma.client.findFirst({
            where: {
                id: clientId,
                businessId,
            },
            include: {
                _count: {
                    select: {
                        invoices: true,
                    },
                },
            },
        });

        if (!client) {
            throw new NotFoundException(
                'Client not found',
            );
        }

        return client;
    }

    // UPDATE CLIENT
    async updateClient(
        businessId: string,
        clientId: string,
        dto: UpdateClientDto,
    ) {
        await this.getClient(businessId, clientId);

        return this.prisma.client.update({
            where: {
                id: clientId,
            },
            data: dto,
        });
    }

    // DELETE CLIENT
    async deleteClient(
        businessId: string,
        clientId: string,
    ) {
        const client = await this.getClient(
            businessId,
            clientId,
        );

        if (client._count.invoices > 0) {
            throw new ConflictException(
                'This client has existing invoices and cannot be deleted',
            );
        }

        await this.prisma.client.delete({
            where: {
                id: clientId,
            },
        });

        return {
            message: 'Client deleted successfully',
        };
    }
}