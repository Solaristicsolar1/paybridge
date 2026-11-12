
import { IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
    @IsIn(['ADMIN', 'ACCOUNTANT', 'MEMBER'])
    role!: 'ADMIN' | 'ACCOUNTANT' | 'MEMBER';
}
