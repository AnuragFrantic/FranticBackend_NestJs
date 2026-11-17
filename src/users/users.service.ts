import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, type Role } from './user.schema.js';

const ROLES: Role[] = ['super_admin', 'admin', 'editor', 'sales'];

type UserInput = {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
};

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  /** Remove the password hash before sending a user to the browser */
  toPublic<T extends { passwordHash?: string }>(u: T) {
    const { passwordHash: _hidden, ...rest } = u;
    return rest;
  }

  findByEmail(email: string) {
    return this.users.findOne({ email: email.toLowerCase().trim() });
  }

  count() {
    return this.users.countDocuments();
  }

  async list() {
    const all = await this.users.find().sort({ createdAt: -1 }).lean();
    return all.map((u) => this.toPublic(u));
  }

  async create(input: UserInput) {
    if (!input.name || !input.email || !input.password) {
      throw new BadRequestException('Name, email and password are required');
    }
    if (input.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (await this.findByEmail(input.email)) throw new BadRequestException('A user with this email already exists');

    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: ROLES.includes(input.role as Role) ? input.role : 'editor',
      isActive: input.isActive ?? true,
    });
    return this.toPublic(user.toObject());
  }

  async update(id: string, input: UserInput) {
    const changes: Record<string, unknown> = {};
    if (input.name) changes.name = input.name;
    if (input.email) changes.email = input.email;
    if (input.role && ROLES.includes(input.role)) changes.role = input.role;
    if (typeof input.isActive === 'boolean') changes.isActive = input.isActive;
    if (input.password) {
      if (input.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
      changes.passwordHash = await bcrypt.hash(input.password, 10);
    }
    const user = await this.users.findByIdAndUpdate(id, changes, { new: true }).lean();
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  async remove(id: string) {
    await this.users.findByIdAndDelete(id);
  }

  /** Used by the seeder to create the first admin */
  async createFirstAdmin(email: string, password: string) {
    return this.users.create({
      name: 'Admin',
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'super_admin',
      isActive: true,
    });
  }
}
