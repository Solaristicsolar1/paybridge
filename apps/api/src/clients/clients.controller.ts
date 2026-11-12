import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { BusinessAccessGuard } from '../permissions/business-access.guard';
import { BusinessRoles } from '../permissions/business-roles.decorator';

import { ClientsService } from './clients.service';

import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Controller('businesses/:businessId/clients')
@UseGuards(JwtAuthGuard, BusinessAccessGuard)
export class ClientsController {
    constructor(
        private readonly clientsService: ClientsService,
    ) { }

    // CREATE CLIENT
    @Post()
    @BusinessRoles('OWNER', 'ADMIN', 'ACCOUNTANT')
    async createClient(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Body() dto: CreateClientDto,
    ) {
        return this.clientsService.createClient(
            businessId,
            dto,
        );
    }

    // LIST CLIENTS
    @Get()
    async getClients(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Query() query: ListClientsDto,
    ) {
        return this.clientsService.getClients(
            businessId,
            query,
        );
    }

    // GET SINGLE CLIENT
    @Get(':clientId')
    async getClient(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('clientId', ParseUUIDPipe) clientId: string,
    ) {
        return this.clientsService.getClient(
            businessId,
            clientId,
        );
    }

    // UPDATE CLIENT
    @Patch(':clientId')
    @BusinessRoles('OWNER', 'ADMIN', 'ACCOUNTANT')
    async updateClient(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('clientId', ParseUUIDPipe) clientId: string,
        @Body() dto: UpdateClientDto,
    ) {
        return this.clientsService.updateClient(
            businessId,
            clientId,
            dto,
        );
    }

    // DELETE CLIENT
    @Delete(':clientId')
    @BusinessRoles('OWNER', 'ADMIN', 'ACCOUNTANT')
    async deleteClient(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('clientId', ParseUUIDPipe) clientId: string,
    ) {
        return this.clientsService.deleteClient(
            businessId,
            clientId,
        );
    }
}