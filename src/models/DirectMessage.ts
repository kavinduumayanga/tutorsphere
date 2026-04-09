import mongoose, { Document, Schema } from 'mongoose';

export interface IDirectMessage extends Document {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DirectMessageSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    isRead: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

DirectMessageSchema.index({ conversationId: 1, createdAt: -1 });
DirectMessageSchema.index({ conversationId: 1, recipientId: 1, isRead: 1, createdAt: -1 });

export const DirectMessage = mongoose.model<IDirectMessage>('DirectMessage', DirectMessageSchema);
