
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import {
    Throttle,
    ThrottlerGuard,
} from '@nestjs/throttler';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

import { BusinessAccessGuard } from '../permissions/business-access.guard';
import { BusinessRoles } from '../permissions/business-roles.decorator';

import { BusinessMembersService } from './business-members.service';

import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

interface BusinessRequest extends Request {
    user: JwtPayload;

    businessMembership?: {
        id: string;
        businessId: string;
        userId: string;
        role: string;
        status: string;
    };
}

type ActorRole = 'OWNER' | 'ADMIN';

@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessMembersController {
    constructor(
        private readonly membersService: BusinessMembersService,
    ) { }

    // ==========================================
    // INVITE MEMBER
    // ==========================================

    @Post(':businessId/members/invite')
    @UseGuards(ThrottlerGuard, BusinessAccessGuard)
    @Throttle({
        default: {
            limit: 5,
            ttl: 60_000,
        },
    })
    @BusinessRoles('OWNER', 'ADMIN')
    async inviteMember(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Body() dto: InviteMemberDto,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.inviteMember(
            businessId,
            request.user.sub,
            request.businessMembership!.role as ActorRole,
            dto,
        );
    }

    // ==========================================
    // LIST BUSINESS MEMBERS
    // ==========================================

    @Get(':businessId/members')
    @UseGuards(BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async getMembers(
        @Param('businessId', ParseUUIDPipe) businessId: string,
    ) {
        return this.membersService.getMembers(businessId);
    }

    // ==========================================
    // LIST BUSINESS INVITATIONS
    // ==========================================

    @Get(':businessId/invitations')
    @UseGuards(BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async getInvitations(
        @Param('businessId', ParseUUIDPipe) businessId: string,
    ) {
        return this.membersService.getInvitations(businessId);
    }

    // ==========================================
    // RESEND INVITATION
    // ==========================================

    @Post(':businessId/invitations/:invitationId/resend')
    @UseGuards(ThrottlerGuard, BusinessAccessGuard)
    @Throttle({
        default: {
            limit: 3,
            ttl: 60_000,
        },
    })
    @BusinessRoles('OWNER', 'ADMIN')
    async resendInvitation(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('invitationId', ParseUUIDPipe) invitationId: string,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.resendInvitation(
            businessId,
            invitationId,
            request.user.sub,
            request.businessMembership!.role as ActorRole,
        );
    }

    // ==========================================
    // REVOKE INVITATION
    // ==========================================

    @Patch(':businessId/invitations/:invitationId/revoke')
    @UseGuards(BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async revokeInvitation(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('invitationId', ParseUUIDPipe) invitationId: string,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.revokeInvitation(
            businessId,
            invitationId,
            request.businessMembership!.role as ActorRole,
        );
    }

    // ==========================================
    // ACCEPT INVITATION
    // ==========================================

    // The recipient must be authenticated.
    // They do not need an existing business membership.

    @Post(':businessId/members/accept')
    @UseGuards(ThrottlerGuard)
    @Throttle({
        default: {
            limit: 5,
            ttl: 60_000,
        },
    })
    async acceptInvitation(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Body() dto: AcceptInvitationDto,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.acceptInvitation(
            businessId,
            request.user.sub,
            dto.token,
        );
    }

    // ==========================================
    // UPDATE MEMBER ROLE
    // ==========================================

    @Patch(':businessId/members/:memberId/role')
    @UseGuards(BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async updateMemberRole(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('memberId', ParseUUIDPipe) memberId: string,
        @Body() dto: UpdateMemberRoleDto,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.updateMemberRole(
            businessId,
            memberId,
            request.businessMembership!.role as ActorRole,
            dto,
        );
    }

    // ==========================================
    // SUSPEND MEMBER
    // ==========================================

    @Patch(':businessId/members/:memberId/suspend')
    @UseGuards(BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async suspendMember(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('memberId', ParseUUIDPipe) memberId: string,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.suspendMember(
            businessId,
            memberId,
            request.user.sub,
            request.businessMembership!.role as ActorRole,
        );
    }

    // ==========================================
    // REACTIVATE MEMBER
    // ==========================================

    @Patch(':businessId/members/:memberId/reactivate')
    @UseGuards(BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async reactivateMember(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('memberId', ParseUUIDPipe) memberId: string,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.reactivateMember(
            businessId,
            memberId,
            request.businessMembership!.role as ActorRole,
        );
    }

    // ==========================================
    // REMOVE MEMBER
    // ==========================================

    @Delete(':businessId/members/:memberId')
    @UseGuards(BusinessAccessGuard)
    @BusinessRoles('OWNER', 'ADMIN')
    async removeMember(
        @Param('businessId', ParseUUIDPipe) businessId: string,
        @Param('memberId', ParseUUIDPipe) memberId: string,
        @Req() request: BusinessRequest,
    ) {
        return this.membersService.removeMember(
            businessId,
            memberId,
            request.user.sub,
            request.businessMembership!.role as ActorRole,
        );
    }
}
