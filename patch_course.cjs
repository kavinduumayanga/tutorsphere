const mongoose = require('mongoose');
require('dotenv').config();

async function patch() {
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required to run patch_course.cjs');
  }

  await mongoose.connect(mongoUri);
  const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false }));
  
  const res = await Course.updateMany(
    { title: 'Advanced Web Development with React' },
    { $set: { isFree: true, price: 0 } }
  );
  console.log('Update result:', res);
  await mongoose.disconnect();
}
patch().catch((error) => {
  console.error(error);
  process.exit(1);
});
