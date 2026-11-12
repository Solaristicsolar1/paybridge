
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessPayoutDto } from './dto/update-business-payout.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessAccessGuard } from '../permissions/business-access.guard';
import { BusinessRoles } from '../permissions/business-roles.decorator';

import type { JwtPayload } from '../auth/strategies/jwt.strategy';

interface AuthenticatedRequest extends Request {
    user: JwtPayload;
}

@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessesController {
    constructor(
        private readonly businessesService: BusinessesService,
    ) { }

    @Post()
    async createBusiness(
        @Body() dto: CreateBusinessDto,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.businessesService.createBusiness(
            request.user.sub,
            dto,
        );
    }

    @Get()
    async getMyBusinesses(
        @Req() request: AuthenticatedRequest,
    ) {
        return this.businessesService.getMyBusinesses(
            request.user.sub,
        );
    }

    @Get(':businessId')
    @UseGuards(JwtAuthGuard, BusinessAccessGuard)
    async getBusiness(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Req() request: AuthenticatedRequest,
    ) {
        return this.businessesService.getBusiness(
            businessId,
            request.user.sub,
        );
    }

    // ==========================================
    // UPDATE BUSINESS BASE PAYOUT ADDRESS
    // ==========================================

    @Patch(':businessId/payout-settings')
    @UseGuards(JwtAuthGuard, BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async updateBasePayoutAddress(
        @Param('businessId', ParseUUIDPipe)
        businessId: string,

        @Body()
        dto: UpdateBusinessPayoutDto,
    ) {
        return this.businessesService.updateBasePayoutAddress(
            businessId,
            dto,
        );
    }
}
