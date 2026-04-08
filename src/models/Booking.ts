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
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentReference?: string;
  paymentFailureReason?: string;
  paidAt?: string;
}

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
  paymentStatus: { type: String, required: true, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  paymentReference: { type: String },
  paymentFailureReason: { type: String },
  paidAt: { type: String },
}, {
  timestamps: true
});

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);