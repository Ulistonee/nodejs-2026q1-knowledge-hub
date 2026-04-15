import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        login: signupDto.login,
      },
    });
    if (user) {
      throw new BadRequestException('Login is already taken');
    }
    const hashedPassword = await bcrypt.hash(signupDto.password, 10);
    await this.prisma.user.create({
      data: {
        login: signupDto.login,
        password: hashedPassword,
      },
    });
    return { message: 'User created successfully' };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        login: loginDto.login,
      },
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

    const payload = {
      userId: user.id,
      login: user.login,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET_KEY,
      expiresIn: (process.env.TOKEN_EXPIRE_TIME ?? '15m') as never,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET_REFRESH_KEY,
      expiresIn: (process.env.TOKEN_REFRESH_EXPIRE_TIME ?? '7d') as never,
    });

    return { accessToken, refreshToken };
  }
}
