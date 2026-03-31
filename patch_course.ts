import mongoose from 'mongoose';
import { connectDB } from './src/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function patch() {
  await connectDB();
  const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false }));
  const res = await Course.updateMany(
    { title: 'Advanced Web Development with React' },
    { $set: { isFree: true, price: 0 } }
  );
  console.log('Update result:', res);
  process.exit(0);
}
patch().catch(console.error);
