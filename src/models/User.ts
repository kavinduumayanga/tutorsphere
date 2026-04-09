import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'student' | 'tutor' | 'admin';
  avatar?: string;
  avatarBlobName?: string;
  avatarMimeType?: string;
  avatarSize?: number;
  phone?: string;
  lastActiveAt?: Date;
}

const UserSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['student', 'tutor', 'admin'], default: 'student' },
  avatar: { type: String },
  avatarBlobName: { type: String },
  avatarMimeType: { type: String },
  avatarSize: { type: Number },
  phone: { type: String },
  lastActiveAt: { type: Date }
}, {
  timestamps: true
});

export const User = mongoose.model<IUser>('User', UserSchema);