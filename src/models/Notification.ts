import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'booking_update'
  | 'session_confirmed'
  | 'session_cancelled'
  | 'session_reschedule_request'
  | 'session_rescheduled'
  | 'session_completed'
  | 'payment_success'
  | 'payment_refunded'
  | 'course_enrolled'
  | 'course_completed'
  | 'profile_update'
  | 'meeting_link_available'
  | 'meeting_link_updated'
  | 'system';

export interface INotification extends Document {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  targetTab?: string;
  relatedEntityId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    link: { type: String },
    targetTab: { type: String },
    relatedEntityId: { type: String },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
