import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async generateTokens(payload: {
    userId: string;
    login: string;
    role: string;
  }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET_KEY,
        expiresIn: (process.env.TOKEN_EXPIRE_TIME ?? '15m') as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET_REFRESH_KEY,
        expiresIn: (process.env.TOKEN_REFRESH_EXPIRE_TIME ?? '7d') as never,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async signup(signupDto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { login: signupDto.login },
    });
    if (existing) {
      throw new BadRequestException('Login is already taken');
    }

    const adminCount = await this.prisma.user.count({
      where: { role: 'ADMIN' },
    });
    const role = adminCount === 0 ? 'ADMIN' : 'VIEWER';

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        login: signupDto.login,
        password: hashedPassword,
        role,
      },
    });
    return { id: user.id };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { login: loginDto.login },
    });
    if (!user) {
      throw new ForbiddenException('Invalid login or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new ForbiddenException('Invalid login or password');
    }

    return this.generateTokens({
      userId: user.id,
      login: user.login,
      role: user.role.toLowerCase(),
    });
  }

  async refresh(refreshDto: RefreshDto) {
    if (!refreshDto.refreshToken || typeof refreshDto.refreshToken !== 'string') {
      throw new UnauthorizedException('No refresh token provided');
    }

    const revoked = await this.prisma.revokedToken.findUnique({
      where: { token: refreshDto.refreshToken },
    });
    if (revoked) {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    try {
      const decoded = await this.jwtService.verifyAsync(refreshDto.refreshToken, {
        secret: process.env.JWT_SECRET_REFRESH_KEY,
      });

      return this.generateTokens({
        userId: decoded.userId,
        login: decoded.login,
        role: decoded.role,
      });
    } catch {
      throw new ForbiddenException('Invalid or expired refresh token');
    }
  }

  async logout(logoutDto: LogoutDto): Promise<void> {
    if (!logoutDto.refreshToken || typeof logoutDto.refreshToken !== 'string') {
      throw new BadRequestException('refreshToken is required');
    }
    const token = logoutDto.refreshToken;

    let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET_REFRESH_KEY,
        ignoreExpiration: true,
      });
      if (decoded?.exp) {
        expiresAt = new Date(decoded.exp * 1000);
      }
    } catch {
    }

    await this.prisma.revokedToken.upsert({
      where: { token },
      update: {},
      create: { token, expiresAt },
    });
  }
}
