const mongoose = require('mongoose');

async function patch() {
  await mongoose.connect('mongodb://localhost:27017/tutorsphere');
  const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false }));
  
  const res = await Course.updateMany(
    { title: 'Advanced Web Development with React' },
    { $set: { isFree: true, price: 0 } }
  );
  console.log('Update result:', res);
  process.exit(0);
}
patch().catch(console.error);
