import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type Role = 'super_admin' | 'admin' | 'editor' | 'sales';

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // never sent to the browser (see UsersService.toPublic)
  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 'editor' })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
