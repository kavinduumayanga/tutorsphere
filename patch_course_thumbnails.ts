import mongoose from 'mongoose';
import { connectDB } from './src/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function patch() {
  await connectDB();
  const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false }));

  const updates = [
    {
      filter: { title: 'Advanced Web Development with React' },
      update: {
        $set: {
          thumbnail:
            'https://www.reactjsindia.com/blog/wp-content/uploads/2021/05/Everything-to-know-about-ReactJs-Web-App-Development.jpg',
        },
      },
    },
    {
      filter: { title: /Pure Mathematics for A\/L/i },
      update: {
        $set: {
          thumbnail:
            'https://pxl-nclacuk.terminalfour.net/prod01/channel_3/mediav8/mathematics-statistics-and-physics/images/maths_header_image_6_opt.jpg',
        },
      },
    },
  ];

  for (const u of updates) {
    const res = await Course.updateMany(u.filter as any, u.update as any);
    console.log('Update result for', u.filter, ':', res);
  }

  process.exit(0);
}

patch().catch((err) => {
  console.error(err);
  process.exit(1);
});
