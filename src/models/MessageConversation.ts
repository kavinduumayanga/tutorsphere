import mongoose, { Document, Schema } from 'mongoose';

export interface IMessageConversation extends Document {
  id: string;
  studentId: string;
  tutorId: string;
  participantIds: string[];
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string;
  unreadCounts: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const MessageConversationSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, required: true, index: true },
    tutorId: { type: String, required: true, index: true },
    participantIds: [{ type: String, required: true, index: true }],
    lastMessagePreview: { type: String, default: '' },
    lastMessageAt: { type: Date },
    lastMessageSenderId: { type: String },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

MessageConversationSchema.index({ studentId: 1, tutorId: 1 }, { unique: true });
MessageConversationSchema.index({ participantIds: 1, lastMessageAt: -1, updatedAt: -1 });

export const MessageConversation = mongoose.model<IMessageConversation>(
  'MessageConversation',
  MessageConversationSchema
);
