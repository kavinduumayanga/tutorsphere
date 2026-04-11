import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  id: string;
  studentId: string;
  studentName?: string;
  tutorId: string;
  slotId: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  subject: string;
  date: string;
  timeSlot?: string;
  meetingLink?: string;
  expertFeedback?: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentReference?: string;
  paymentFailureReason?: string;
  paidAt?: string;
  refundedAt?: string;
  refundReason?: string;
  sessionDurationHours?: number;
  sessionAmount?: number;
  rescheduleRequest?: {
    requestedDate: string;
    requestedTimeSlot: string;
    requestedSlotId?: string;
    note?: string;
    requestedAt: string;
    requestedByTutorId: string;
    status: 'pending';
  };
  sessionResources?: Array<{
    id: string;
    name: string;
    url: string;
    blobName?: string;
    containerName?: string;
    mimeType?: string;
    size?: number;
    uploadedByTutorId?: string;
    uploadedAt?: string;
  }>;
  hiddenForTutor?: boolean;
  hiddenForStudent?: boolean;
}

const BookingRescheduleRequestSchema = new Schema(
  {
    requestedDate: { type: String, required: true },
    requestedTimeSlot: { type: String, required: true },
    requestedSlotId: { type: String },
    note: { type: String },
    requestedAt: { type: String, required: true },
    requestedByTutorId: { type: String, required: true },
    status: { type: String, enum: ['pending'], default: 'pending' },
  },
  { _id: false }
);

const BookingSessionResourceSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    blobName: { type: String },
    containerName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    uploadedByTutorId: { type: String },
    uploadedAt: { type: String },
  },
  { _id: false }
);

const BookingSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  studentName: { type: String },
  tutorId: { type: String, required: true },
  slotId: { type: String, required: true },
  status: { type: String, required: true, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  subject: { type: String, required: true },
  date: { type: String, required: true },
  timeSlot: { type: String },
  meetingLink: { type: String },
  expertFeedback: { type: String },
  paymentStatus: { type: String, required: true, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentReference: { type: String },
  paymentFailureReason: { type: String },
  paidAt: { type: String },
  refundedAt: { type: String },
  refundReason: { type: String },
  sessionDurationHours: { type: Number },
  sessionAmount: { type: Number },
  rescheduleRequest: { type: BookingRescheduleRequestSchema },
  sessionResources: { type: [BookingSessionResourceSchema], default: [] },
  hiddenForTutor: { type: Boolean, default: false },
  hiddenForStudent: { type: Boolean, default: false },
}, {
  timestamps: true
});

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);