import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'student' | 'tutor' | 'admin';
  avatar?: string;
  phone?: string;
}

const UserSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, enum: ['student', 'tutor', 'admin'], default: 'student' },
  avatar: { type: String },
  phone: { type: String }
}, {
  timestamps: true
});

export const User = mongoose.model<IUser>('User', UserSchema);