
import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';

import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';

import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

type ActorRole = 'OWNER' | 'ADMIN';

const INVITATION_VALIDITY_DAYS = 7;

@Injectable()
export class BusinessMembersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    // ==========================================
    // TOKEN UTILITIES
    // ==========================================

    private generateToken(): string {
        return randomBytes(32).toString('hex');
    }

    private hashToken(token: string): string {
        return createHash('sha256')
            .update(token)
            .digest('hex');
    }

    private getExpiryDate(): Date {
        return new Date(
            Date.now() +
            INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
        );
    }

    private getInvitationUrl(
        businessId: string,
        token: string,
    ): string {
        const webOrigin = process.env.WEB_ORIGIN;

        if (!webOrigin) {
            throw new ServiceUnavailableException(
                'WEB_ORIGIN is not configured',
            );
        }

        let origin: URL;

        try {
            origin = new URL(webOrigin);
        } catch {
            throw new ServiceUnavailableException(
                'WEB_ORIGIN is invalid',
            );
        }

        if (
            origin.protocol !== 'http:' &&
            origin.protocol !== 'https:'
        ) {
            throw new ServiceUnavailableException(
                'WEB_ORIGIN must use HTTP or HTTPS',
            );
        }

        const invitationUrl = new URL(
            '/invitations/accept',
            origin,
        );

        invitationUrl.searchParams.set(
            'businessId',
            businessId,
        );

        invitationUrl.searchParams.set('token', token);

        return invitationUrl.toString();
    }

    private isUniqueConstraintError(error: unknown): boolean {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002'
        );
    }

    private checkAdminTarget(
        actorRole: ActorRole,
        targetRole: string,
    ): void {
        if (
            actorRole === 'ADMIN' &&
            targetRole !== 'ACCOUNTANT' &&
            targetRole !== 'MEMBER'
        ) {
            throw new ForbiddenException(
                'Administrators cannot manage owners or other administrators',
            );
        }
    }

    // ==========================================
    // EMAIL DELIVERY
    // ==========================================

    private async deliverInvitation(
        data: {
            email: string;
            businessName: string;
            inviterName: string;
            role: string;
            businessId: string;
            token: string;
            expiresAt: Date;
        },
    ): Promise<void> {
        const invitationUrl = this.getInvitationUrl(
            data.businessId,
            data.token,
        );

        try {
            await this.mailService.sendBusinessInvitation({
                email: data.email,
                businessName: data.businessName,
                inviterName: data.inviterName,
                role: data.role,
                invitationUrl,
                expiresAt: data.expiresAt,
            });
        } catch {
            throw new ServiceUnavailableException(
                'Invitation was saved, but email delivery failed. Please resend the invitation.',
            );
        }
    }

    // ==========================================
    // INVITE A MEMBER
    // ==========================================

    async inviteMember(
        businessId: string,
        requesterId: string,
        actorRole: ActorRole,
        dto: InviteMemberDto,
    ) {
        const email = dto.email.trim().toLowerCase();

        if (
            actorRole === 'ADMIN' &&
            dto.role === 'ADMIN'
        ) {
            throw new ForbiddenException(
                'Only the business owner can invite administrators',
            );
        }

        const token = this.generateToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = this.getExpiryDate();

        // Validate email configuration before creating the record.
        this.getInvitationUrl(businessId, token);

        const [business, requester, existingUser] =
            await Promise.all([
                this.prisma.business.findUnique({
                    where: { id: businessId },
                    select: {
                        id: true,
                        name: true,
                    },
                }),

                this.prisma.user.findUnique({
                    where: { id: requesterId },
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    },
                }),

                this.prisma.user.findUnique({
                    where: { email },
                    select: {
                        id: true,
                        email: true,
                    },
                }),
            ]);

        if (!business || !requester) {
            throw new NotFoundException(
                'Business or requesting user not found',
            );
        }

        if (requester.email.toLowerCase() === email) {
            throw new ConflictException(
                'You cannot invite yourself',
            );
        }

        // If the recipient already has a membership,
        // do not create a duplicate membership.
        if (existingUser) {
            const membership =
                await this.prisma.businessMember.findUnique({
                    where: {
                        businessId_userId: {
                            businessId,
                            userId: existingUser.id,
                        },
                    },
                    select: {
                        status: true,
                    },
                });

            if (membership) {
                if (membership.status === 'ACTIVE') {
                    throw new ConflictException(
                        'This user is already an active member',
                    );
                }

                if (membership.status === 'SUSPENDED') {
                    throw new ConflictException(
                        'This user is suspended from the business',
                    );
                }

                // Legacy INVITED memberships are allowed
                // temporarily. They are activated upon acceptance.
            }
        }

        // Reject an existing pending invitation.
        // Use the resend endpoint to resend it.
        const pendingInvitation =
            await this.prisma.businessInvitation.findFirst({
                where: {
                    businessId,
                    email,
                    status: 'PENDING',
                },
                select: {
                    id: true,
                },
            });

        if (pendingInvitation) {
            throw new ConflictException(
                'A pending invitation already exists. Use the resend endpoint.',
            );
        }

        let invitation;

        try {
            invitation =
                await this.prisma.businessInvitation.create({
                    data: {
                        businessId,
                        email,
                        role: dto.role,
                        status: 'PENDING',
                        tokenHash,
                        expiresAt,
                        invitedById: requesterId,
                    },
                    select: {
                        id: true,
                        businessId: true,
                        email: true,
                        role: true,
                        status: true,
                        expiresAt: true,
                        createdAt: true,
                    },
                });
        } catch (error) {
            if (this.isUniqueConstraintError(error)) {
                throw new ConflictException(
                    'A pending invitation already exists for this email',
                );
            }

            throw error;
        }

        await this.deliverInvitation({
            email,
            businessName: business.name,
            inviterName:
                requester.displayName ?? requester.email,
            role: invitation.role,
            businessId,
            token,
            expiresAt,
        });

        return {
            message: 'Invitation sent successfully',
            invitation,
        };
    }

    // ==========================================
    // LIST INVITATIONS
    // ==========================================

    async getInvitations(businessId: string) {
        return this.prisma.businessInvitation.findMany({
            where: {
                businessId,
            },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                expiresAt: true,
                acceptedAt: true,
                revokedAt: true,
                createdAt: true,
                invitedBy: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    // ==========================================
    // RESEND INVITATION
    // ==========================================

    async resendInvitation(
        businessId: string,
        invitationId: string,
        requesterId: string,
        actorRole: ActorRole,
    ) {
        const invitation =
            await this.prisma.businessInvitation.findFirst({
                where: {
                    id: invitationId,
                    businessId,
                },
                include: {
                    business: {
                        select: {
                            name: true,
                        },
                    },
                },
            });

        if (!invitation) {
            throw new NotFoundException(
                'Invitation not found',
            );
        }

        if (invitation.status !== 'PENDING') {
            throw new ConflictException(
                'Only pending invitations can be resent',
            );
        }

        this.checkAdminTarget(
            actorRole,
            invitation.role,
        );

        const requester = await this.prisma.user.findUnique({
            where: {
                id: requesterId,
            },
            select: {
                email: true,
                displayName: true,
            },
        });

        if (!requester) {
            throw new NotFoundException(
                'Requesting user not found',
            );
        }


        const token = this.generateToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = this.getExpiryDate();

        // Atomically rotate the invitation token.
        // The invitation must still be pending and its
        // previous token hash must remain unchanged.
        const rotation =
            await this.prisma.businessInvitation.updateMany({
                where: {
                    id: invitationId,
                    businessId,
                    status: 'PENDING',
                    tokenHash: invitation.tokenHash,
                },
                data: {
                    tokenHash,
                    expiresAt,
                    invitedById: requesterId,
                },
            });

        if (rotation.count !== 1) {
            throw new ConflictException(
                'Invitation has already been processed or resent. Please refresh and try again.',
            );
        }

        await this.deliverInvitation({
            email: invitation.email,
            businessName: invitation.business.name,
            inviterName:
                requester.displayName ?? requester.email,
            role: invitation.role,
            businessId,
            token,
            expiresAt,
        });

        return {
            message: 'Invitation resent successfully',
            invitationId,
            email: invitation.email,
            expiresAt,
        };
    }

    // ==========================================
    // REVOKE INVITATION
    // ==========================================

    async revokeInvitation(
        businessId: string,
        invitationId: string,
        actorRole: ActorRole,
    ) {
        const invitation =
            await this.prisma.businessInvitation.findFirst({
                where: {
                    id: invitationId,
                    businessId,
                },
                select: {
                    id: true,
                    role: true,
                    status: true,
                },
            });

        if (!invitation) {
            throw new NotFoundException(
                'Invitation not found',
            );
        }

        this.checkAdminTarget(
            actorRole,
            invitation.role,
        );

        if (invitation.status !== 'PENDING') {
            throw new ConflictException(
                'Only pending invitations can be revoked',
            );
        }

        const result =
            await this.prisma.businessInvitation.updateMany({
                where: {
                    id: invitationId,
                    businessId,
                    status: 'PENDING',
                },
                data: {
                    status: 'REVOKED',
                    revokedAt: new Date(),
                    tokenHash: null,
                },
            });

        if (result.count !== 1) {
            throw new ConflictException(
                'Invitation has already been processed',
            );
        }

        return {
            message: 'Invitation revoked successfully',
            invitationId,
        };
    }

    // ==========================================
    // ACCEPT INVITATION
    // ==========================================

    async acceptInvitation(
        businessId: string,
        userId: string,
        rawToken: string,
    ) {
        const tokenHash = this.hashToken(rawToken);
        const now = new Date();

        const user = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                email: true,
            },
        });

        if (!user) {
            throw new NotFoundException(
                'User account not found',
            );
        }

        const invitation =
            await this.prisma.businessInvitation.findUnique({
                where: {
                    tokenHash,
                },
                select: {
                    id: true,
                    businessId: true,
                    email: true,
                    role: true,
                    status: true,
                    expiresAt: true,
                },
            });

        if (
            !invitation ||
            invitation.businessId !== businessId ||
            invitation.status !== 'PENDING' ||
            invitation.expiresAt <= now
        ) {
            throw new NotFoundException(
                'Invitation is invalid, expired, or already used',
            );
        }

        // The authenticated account must match
        // the email address receiving the invitation.
        if (
            invitation.email.toLowerCase() !==
            user.email.toLowerCase()
        ) {
            throw new ForbiddenException(
                'This invitation was sent to a different email address',
            );
        }

        // Consume the invitation and activate membership
        // inside one database transaction.
        return this.prisma.$transaction(async (tx) => {
            const consumed =
                await tx.businessInvitation.updateMany({
                    where: {
                        id: invitation.id,
                        businessId,
                        tokenHash,
                        email: invitation.email,
                        status: 'PENDING',
                        expiresAt: {
                            gt: now,
                        },
                    },
                    data: {
                        status: 'ACCEPTED',
                        acceptedAt: now,
                        tokenHash: null,
                    },
                });

            if (consumed.count !== 1) {
                throw new ConflictException(
                    'This invitation has already been accepted or revoked',
                );
            }

            const existingMembership =
                await tx.businessMember.findUnique({
                    where: {
                        businessId_userId: {
                            businessId,
                            userId,
                        },
                    },
                });

            let membership;

            if (existingMembership) {
                if (
                    existingMembership.status === 'ACTIVE'
                ) {
                    throw new ConflictException(
                        'You are already an active member',
                    );
                }

                if (
                    existingMembership.status === 'SUSPENDED'
                ) {
                    throw new ForbiddenException(
                        'Your membership is suspended',
                    );
                }

                // Upgrade an old legacy INVITED membership.
                membership =
                    await tx.businessMember.update({
                        where: {
                            id: existingMembership.id,
                        },
                        data: {
                            role: invitation.role,
                            status: 'ACTIVE',
                            joinedAt: now,
                            invitationTokenHash: null,
                            invitationExpiresAt: null,
                        },
                    });
            } else {
                membership =
                    await tx.businessMember.create({
                        data: {
                            businessId,
                            userId,
                            role: invitation.role,
                            status: 'ACTIVE',
                            invitedAt: invitation.expiresAt
                                ? now
                                : null,
                            joinedAt: now,
                        },
                    });
            }

            return {
                message: 'Invitation accepted successfully',
                membership: {
                    id: membership.id,
                    businessId: membership.businessId,
                    role: membership.role,
                    status: membership.status,
                    joinedAt: membership.joinedAt,
                },
            };
        });
    }

    // ==========================================
    // LIST BUSINESS MEMBERS
    // ==========================================

    async getMembers(businessId: string) {
        return this.prisma.businessMember.findMany({
            where: {
                businessId,
            },
            select: {
                id: true,
                role: true,
                status: true,
                invitedAt: true,
                joinedAt: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    // ==========================================
    // FIND TARGET MEMBER
    // ==========================================

    private async findTargetMember(
        businessId: string,
        memberId: string,
    ) {
        const member =
            await this.prisma.businessMember.findFirst({
                where: {
                    id: memberId,
                    businessId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            displayName: true,
                        },
                    },
                },
            });

        if (!member) {
            throw new NotFoundException(
                'Business member not found',
            );
        }

        if (member.role === 'OWNER') {
            throw new ForbiddenException(
                'Business ownership cannot be changed through member management',
            );
        }

        return member;
    }

    // ==========================================
    // UPDATE MEMBER ROLE
    // ==========================================

    async updateMemberRole(
        businessId: string,
        memberId: string,
        actorRole: ActorRole,
        dto: UpdateMemberRoleDto,
    ) {
        const member = await this.findTargetMember(
            businessId,
            memberId,
        );

        this.checkAdminTarget(
            actorRole,
            member.role,
        );

        if (
            actorRole === 'ADMIN' &&
            dto.role === 'ADMIN'
        ) {
            throw new ForbiddenException(
                'Only the business owner can assign administrator roles',
            );
        }

        return this.prisma.businessMember.update({
            where: {
                id: memberId,
            },
            data: {
                role: dto.role,
            },
            select: {
                id: true,
                businessId: true,
                role: true,
                status: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    },
                },
            },
        });
    }

    // ==========================================
    // SUSPEND MEMBER
    // ==========================================

    async suspendMember(
        businessId: string,
        memberId: string,
        requesterId: string,
        actorRole: ActorRole,
    ) {
        const member = await this.findTargetMember(
            businessId,
            memberId,
        );

        if (member.userId === requesterId) {
            throw new ForbiddenException(
                'You cannot suspend your own membership',
            );
        }

        this.checkAdminTarget(
            actorRole,
            member.role,
        );

        if (member.status === 'SUSPENDED') {
            throw new ConflictException(
                'This member is already suspended',
            );
        }

        if (member.status === 'INVITED') {
            throw new ConflictException(
                'Legacy pending memberships cannot be suspended',
            );
        }

        return this.prisma.businessMember.update({
            where: {
                id: memberId,
            },
            data: {
                status: 'SUSPENDED',
            },
            select: {
                id: true,
                role: true,
                status: true,
            },
        });
    }

    // ==========================================
    // REACTIVATE MEMBER
    // ==========================================

    async reactivateMember(
        businessId: string,
        memberId: string,
        actorRole: ActorRole,
    ) {
        const member = await this.findTargetMember(
            businessId,
            memberId,
        );

        this.checkAdminTarget(
            actorRole,
            member.role,
        );

        if (member.status !== 'SUSPENDED') {
            throw new ConflictException(
                'Only suspended members can be reactivated',
            );
        }

        return this.prisma.businessMember.update({
            where: {
                id: memberId,
            },
            data: {
                status: 'ACTIVE',
            },
            select: {
                id: true,
                role: true,
                status: true,
            },
        });
    }

    // ==========================================
    // REMOVE MEMBER
    // ==========================================

    async removeMember(
        businessId: string,
        memberId: string,
        requesterId: string,
        actorRole: ActorRole,
    ) {
        const member = await this.findTargetMember(
            businessId,
            memberId,
        );

        if (member.userId === requesterId) {
            throw new ForbiddenException(
                'You cannot remove your own membership through this endpoint',
            );
        }

        this.checkAdminTarget(
            actorRole,
            member.role,
        );

        await this.prisma.businessMember.delete({
            where: {
                id: memberId,
            },
        });

        return {
            message: 'Business membership removed successfully',
            memberId,
        };
    }
}
