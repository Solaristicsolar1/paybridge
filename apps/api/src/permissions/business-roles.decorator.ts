
import { SetMetadata } from '@nestjs/common';

export const BUSINESS_ROLES_KEY = 'business_roles';

export type BusinessRole =
    | 'OWNER'
    | 'ADMIN'
    | 'ACCOUNTANT'
    | 'MEMBER';

export const BusinessRoles = (...roles: BusinessRole[]) =>
    SetMetadata(BUSINESS_ROLES_KEY, roles);
