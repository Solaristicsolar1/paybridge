
import {
    IsString,
    Length,
    Matches,
} from 'class-validator';

export class ResetPasswordDto {
    @IsString()
    @Length(64, 64)
    @Matches(/^[a-f0-9]{64}$/i)
    token!: string;

    @IsString()
    @Length(12, 128)
    newPassword!: string;

    @IsString()
    @Length(12, 128)
    confirmPassword!: string;
}
