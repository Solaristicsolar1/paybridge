import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
    BusinessAccessGuard,
} from '../permissions/business-access.guard';

import { PaymentsService } from './payments.service';

import {
    NearIntentsService,
} from './near-intents/near-intents.service';

import { ListPaymentsDto } from './dto/list-payments.dto';

import {
    CreateNearQuoteDto,
} from './near-intents/dto/create-quote.dto';

@Controller('businesses/:businessId/payments')
@UseGuards(JwtAuthGuard, BusinessAccessGuard)
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly nearIntentsService: NearIntentsService,
    ) { }

    // ==========================================
    // GET NEAR INTENTS SUPPORTED TOKENS
    // ==========================================

    @Get('near/tokens')
    async getNearSupportedTokens(
        @Param('businessId', ParseUUIDPipe)
        _businessId: string,
    ) {
        return this.nearIntentsService.getSupportedTokens();
    }

    // ==========================================
    // GENERATE NEAR INTENTS DRY-RUN QUOTE
    // ==========================================

    @Post('near/quote')
    async createNearQuote(
        @Param('businessId', ParseUUIDPipe)
        _businessId: string,

        @Body()
        dto: CreateNearQuoteDto,
    ) {
        return this.nearIntentsService.createQuote(dto);
    }

    // ==========================================
    // LIST BUSINESS PAYMENTS
    // ==========================================

    @Get()
    async getPayments(
        @Param('businessId', ParseUUIDPipe)
        businessId: string,

        @Query()
        query: ListPaymentsDto,
    ) {
        return this.paymentsService.getPayments(
            businessId,
            query,
        );
    }

    // ==========================================
    // GET SINGLE BUSINESS PAYMENT
    // ==========================================

    @Get(':paymentId')
    async getPayment(
        @Param('businessId', ParseUUIDPipe)
        businessId: string,

        @Param('paymentId', ParseUUIDPipe)
        paymentId: string,
    ) {
        return this.paymentsService.getPayment(
            businessId,
            paymentId,
        );
    }
}
