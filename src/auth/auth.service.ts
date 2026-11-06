import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser, toAuthenticatedUser } from './authenticated-user';
import { CredentialsDto } from './dto/credentials.dto';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const BCRYPT_ROUNDS = 12;
// Compared for unknown emails, so they take as long to reject as wrong passwords.
const DUMMY_HASH =
  '$2b$12$SqLZn41g08U46Zrk2Y932uzU0NQq9fPZUzstK8k9W2GRI6oE/OY0a';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async register({ email, password, nickname }: RegisterDto) {
    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const user = await this.usersService.create(email, nickname, passwordHash);
    // Mails a code to confirm the email. The token works meanwhile, so the
    // user can confirm and read, but not write, until they do.
    await this.emailVerificationService.start(user.id);
    return this.issueToken(user.id);
  }

  async login({ email, password }: CredentialsDto) {
    const user = await this.usersService.findCredentials(email);
    const matches = await compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !matches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user.id);
  }

  async updateProfile(
    userId: string,
    { nickname }: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    return toAuthenticatedUser(
      await this.usersService.setNickname(userId, nickname),
    );
  }

  private async issueToken(userId: string) {
    return { accessToken: await this.jwtService.signAsync({ sub: userId }) };
  }
}
