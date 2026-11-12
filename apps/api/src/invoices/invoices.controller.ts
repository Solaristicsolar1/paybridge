import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

import { BusinessAccessGuard } from '../permissions/business-access.guard';
import { BusinessRoles } from '../permissions/business-roles.decorator';

import { InvoicesService } from './invoices.service';

import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

interface AuthenticatedRequest extends Request {
    user: JwtPayload;
}

// ==========================================
// BUSINESS INVOICE ENDPOINTS
// ==========================================

@Controller('businesses/:businessId/invoices')
@UseGuards(JwtAuthGuard, BusinessAccessGuard)
export class InvoicesController {
    constructor(
        private readonly invoicesService: InvoicesService,
    ) {}

    // CREATE DRAFT INVOICE
    @Post()
    @BusinessRoles('OWNER', 'ADMIN', 'ACCOUNTANT')
    async createInvoice(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Body() dto: CreateInvoiceDto,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.invoicesService.createInvoice(
            businessId,
            request.user.sub,
            dto,
        );
    }

    // LIST INVOICES
    @Get()
    async getInvoices(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Query() query: ListInvoicesDto,
    ) {
        return this.invoicesService.getInvoices(
            businessId,
            query,
        );
    }

    // GET SINGLE INVOICE
    @Get(':invoiceId')
    async getInvoice(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    ) {
        return this.invoicesService.getInvoice(
            businessId,
            invoiceId,
        );
    }

    // UPDATE DRAFT INVOICE
    @Patch(':invoiceId')
    @BusinessRoles('OWNER', 'ADMIN', 'ACCOUNTANT')
    async updateInvoice(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
        @Body() dto: UpdateInvoiceDto,
    ) {
        return this.invoicesService.updateInvoice(
            businessId,
            invoiceId,
            dto,
        );
    }

    // ISSUE INVOICE
    @Post(':invoiceId/issue')
    @BusinessRoles('OWNER', 'ADMIN', 'ACCOUNTANT')
    async issueInvoice(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    ) {
        return this.invoicesService.issueInvoice(
            businessId,
            invoiceId,
        );
    }

    // CANCEL INVOICE
    @Post(':invoiceId/cancel')
    @BusinessRoles('OWNER', 'ADMIN')
    async cancelInvoice(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    ) {
        return this.invoicesService.cancelInvoice(
            businessId,
            invoiceId,
        );
    }
}

// ==========================================
// PUBLIC INVOICE ENDPOINT
// ==========================================

@Controller('public/invoices')
export class PublicInvoicesController {
    constructor(
        private readonly invoicesService: InvoicesService,
    ) {}

    @Get(':token')
    async getPublicInvoice(
        @Param('token') token: string,
    ) {
        return this.invoicesService.getPublicInvoice(token);
    }
}
