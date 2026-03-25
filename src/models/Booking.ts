import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  id: string;
  studentId: string;
  tutorId: string;
  slotId: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  subject: string;
  date: string;
  meetingLink?: string;
  expertFeedback?: string;
}

const BookingSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  tutorId: { type: String, required: true },
  slotId: { type: String, required: true },
  status: { type: String, required: true, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  subject: { type: String, required: true },
  date: { type: String, required: true },
  meetingLink: { type: String },
  expertFeedback: { type: String }
}, {
  timestamps: true
});

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);