import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private users = [];

  findAll() {
    return this.users;
  }

  create(userDto: CreateUserDto) {
    const user = { id: this.users.length + 1, ...userDto };
    this.users.push(user);
    return user;
  }
}