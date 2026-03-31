import mongoose, { Document, Schema } from 'mongoose';

export interface IResource extends Document {
  id: string;
  tutorId?: string;
  title: string;
  type: 'Paper' | 'Article' | 'Note';
  subject: string;
  url: string;
  description?: string;
  isFree: boolean;
}

const ResourceSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  tutorId: { type: String },
  title: { type: String, required: true },
  type: { type: String, required: true, enum: ['Paper', 'Article', 'Note'] },
  subject: { type: String, required: true },
  url: { type: String, required: true },
  description: { type: String },
  isFree: { type: Boolean, required: true, default: true }
}, {
  timestamps: true
});

export const Resource = mongoose.model<IResource>('Resource', ResourceSchema);