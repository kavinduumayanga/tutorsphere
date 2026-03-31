import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import { connectDB } from "./src/database.js";
import { User } from "./src/models/User.js";
import { Tutor } from "./src/models/Tutor.js";
import { Review } from "./src/models/Review.js";
import { Course } from "./src/models/Course.js";
import { Resource } from "./src/models/Resource.js";
import { Booking } from "./src/models/Booking.js";
import { Question } from "./src/models/Question.js";
import { Quiz } from "./src/models/Quiz.js";
import { StudyPlan } from "./src/models/StudyPlan.js";
import { SkillLevel } from "./src/models/SkillLevel.js";

// Load environment variables
dotenv.config();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
      return cb(new Error('Only PNG and JPEG files are allowed for profile pictures'));
    }
    cb(null, true);
  },
});

const handleAvatarUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single('avatar')(req, res, (error: any) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Profile picture must be less than 5MB' });
      }
      return res.status(400).json({ error: error.message });
    }

    return res.status(400).json({ error: error.message || 'Avatar upload failed' });
  });
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const resolveStoredAvatarPath = (storedAvatar?: string): string | null => {
  if (!storedAvatar) {
    return null;
  }

  const directPath = path.resolve(storedAvatar);
  if (directPath.startsWith(UPLOADS_DIR + path.sep)) {
    return directPath;
  }

  try {
    const parsed = new URL(storedAvatar);
    const fileNameFromUrl = path.basename(parsed.pathname);
    if (fileNameFromUrl.startsWith('avatar-')) {
      return path.join(UPLOADS_DIR, fileNameFromUrl);
    }
  } catch {
    // Ignore non-URL values
  }

  const fileName = path.basename(storedAvatar);
  if (fileName.startsWith('avatar-')) {
    return path.join(UPLOADS_DIR, fileName);
  }

  return null;
};

async function migrateUsers() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    const USERS_DB_PATH = path.join(__dirname, "users.json");

    // Check if users.json exists
    try {
      await fs.access(USERS_DB_PATH);
    } catch (error) {
      console.log('users.json not found, skipping migration');
      return;
    }

    const usersData = await fs.readFile(USERS_DB_PATH, "utf-8");
    const users = JSON.parse(usersData);

    let migratedCount = 0;
    for (const userData of users) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const [firstName, ...lastNameParts] = userData.name.split(' ');
        const lastName = lastNameParts.join(' ') || '';
        await User.create({ ...userData, firstName, lastName });
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} users from JSON to MongoDB`);
    }
  } catch (error) {
    console.log('Migration skipped or failed:', error.message);
  }
}

async function migrateMockData() {
  try {
    // Check if mock data already exists
    const tutorCount = await Tutor.countDocuments();
    if (tutorCount > 0) {
      return;
    }

    // Import mock data
    const { MOCK_TUTORS, MOCK_REVIEWS, MOCK_COURSES, MOCK_RESOURCES } = await import('./src/data/mockData.js');

    // Migrate tutors
    for (const tutorData of MOCK_TUTORS) {
      const existingTutor = await Tutor.findOne({ email: tutorData.email });
      if (!existingTutor) {
        await Tutor.create(tutorData);
      }
    }
    console.log(`Migrated ${MOCK_TUTORS.length} tutors`);

    // Migrate reviews
    for (const reviewData of MOCK_REVIEWS) {
      const existingReview = await Review.findOne({ id: reviewData.id });
      if (!existingReview) {
        await Review.create(reviewData);
      }
    }
    console.log(`Migrated ${MOCK_REVIEWS.length} reviews`);

    // Migrate courses
    for (const courseData of MOCK_COURSES) {
      const existingCourse = await Course.findOne({ id: courseData.id });
      if (!existingCourse) {
        await Course.create(courseData);
      }
    }
    console.log(`Migrated ${MOCK_COURSES.length} courses`);

    // Migrate resources
    for (const resourceData of MOCK_RESOURCES) {
      const existingResource = await Resource.findOne({ id: resourceData.id });
      if (!existingResource) {
        await Resource.create(resourceData);
      }
    }
    console.log(`Migrated ${MOCK_RESOURCES.length} resources`);

  } catch (error) {
    console.log('Mock data migration failed:', error.message);
  }
}

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  // Migrate existing users from JSON to MongoDB if needed
  await migrateUsers();

  // Migrate mock data to MongoDB if needed
  await migrateMockData();

  // Ensure uploads directory exists before handling multipart avatar uploads
  await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });

  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Auth APIs
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { firstName, lastName, email, password, role } = req.body;
      const normalizedEmail = email ? email.trim() : '';
      const escapedEmail = normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

      // Check if user already exists
      const existingUser = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const id = Math.random().toString(36).substr(2, 9);
      const newUser = new User({ id, firstName, lastName, email: normalizedEmail, password, role: role || 'student' });

      await newUser.save();

      res.json({ id, firstName: newUser.firstName, lastName: newUser.lastName, email, role: newUser.role });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const normalizedEmail = email.trim();
      const escapedEmail = normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const user = await User.findOne({ 
        email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }, 
        password 
      });

      if (user) {
        const avatarUrl = user.avatar ? `${req.protocol}://${req.get('host')}/api/auth/user/${user.id}/avatar` : undefined;
        // Fallback to splitting name for old users if firstName is missing
        let fName = user.firstName;
        let lName = user.lastName;
        if (!fName && !lName && (user as any).name) {
          const parts = (user as any).name.split(' ');
          fName = parts[0] || 'User';
          lName = parts.slice(1).join(' ') || '';
        }
        res.json({ id: user.id, firstName: fName || 'User', lastName: lName || '', email: user.email, role: user.role, avatar: avatarUrl, phone: user.phone });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/auth/user/:id", handleAvatarUpload, async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, phone } = req.body;

      const user = await User.findOne({ id });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phone !== undefined) user.phone = phone;
      if (req.file) {
        const oldAvatarPath = resolveStoredAvatarPath(user.avatar);

        // Delete the old avatar file if it exists
        if (oldAvatarPath && oldAvatarPath !== req.file.path) {
          try {
            await fs.unlink(oldAvatarPath);
            console.log('Old avatar file deleted:', oldAvatarPath);
          } catch (deleteError) {
            const err = deleteError as NodeJS.ErrnoException;
            if (err.code !== 'ENOENT') {
              console.warn('Failed to delete old avatar file:', oldAvatarPath, deleteError);
            }
          }
        }

        user.avatar = req.file.path;
        console.log('Avatar uploaded:', { size: req.file.size, mimetype: req.file.mimetype, path: req.file.path });
      }

      await user.save();

      const avatarUrl = user.avatar ? `${req.protocol}://${req.get('host')}/api/auth/user/${user.id}/avatar` : undefined;
      res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, avatar: avatarUrl, phone: user.phone });
    } catch (error) {
      console.error("Update user error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/auth/user/:id/avatar", async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Avatar request for user:', id);
      const user = await User.findOne({ id });
      console.log('User found:', !!user, 'Has avatar:', !!user?.avatar, 'Avatar value:', user?.avatar);
      if (!user || !user.avatar) {
        console.log('Avatar not found for user:', id);
        return res.status(404).json({ error: "Avatar not found" });
      }

      // Check if avatar is a file path (new format) or binary data (old format)
      if (typeof user.avatar === 'string' && !user.avatar.includes('\x00')) {
        // New format: file path
        try {
          const avatarPath = resolveStoredAvatarPath(user.avatar) || path.resolve(user.avatar);
          console.log('Reading avatar from path:', avatarPath);
          const avatarData = await fs.readFile(avatarPath);

          // Determine content type from file extension
          const ext = path.extname(avatarPath).toLowerCase();
          const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

          res.set('Content-Type', contentType);
          res.send(avatarData);
        } catch (fileError) {
          console.error('Error reading avatar file:', fileError);
          res.status(404).json({ error: "Avatar file not found" });
        }
      } else {
        // Old format: binary data stored in database
        console.log('Serving legacy binary avatar data');
        // For backward compatibility, try to serve as JPEG (most common)
        res.set('Content-Type', 'image/jpeg');
        res.send(user.avatar);
      }
    } catch (error) {
      console.error("Get avatar error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Tutor APIs
  app.get("/api/tutors", async (req, res) => {
    try {
      const tutors = await Tutor.find();
      res.json(tutors);
    } catch (error) {
      console.error("Get tutors error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/tutors/:id", async (req, res) => {
    try {
      const tutor = await Tutor.findOne({ id: req.params.id });
      if (tutor) {
        res.json(tutor);
      } else {
        res.status(404).json({ error: "Tutor not found" });
      }
    } catch (error) {
      console.error("Get tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/tutors", async (req, res) => {
    try {
      const tutorData = req.body;
      const id = tutorData.id || Math.random().toString(36).substr(2, 9);
      const tutor = new Tutor({ ...tutorData, id });
      await tutor.save();
      res.json(tutor);
    } catch (error) {
      console.error("Create tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/tutors/:id", async (req, res) => {
    try {
      let tutor = await Tutor.findOne({ id: req.params.id });

      if (tutor) {
        tutor = await Tutor.findOneAndUpdate(
          { id: req.params.id },
          req.body,
          { new: true }
        );
        res.json(tutor);
      } else {
        const user = await User.findOne({ id: req.params.id });
        if (!user) {
          return res.status(404).json({ error: "User not found for tutor profile" });
        }

        tutor = new Tutor({
          id: user.id,
          name: `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`,
          email: user.email,
          role: 'tutor',
          qualifications: req.body.qualifications || 'Not specified',
          subjects: req.body.subjects || [],
          teachingLevel: req.body.teachingLevel || 'School',
          pricePerHour: req.body.pricePerHour || 0,
          rating: 0,
          reviewCount: 0,
          bio: req.body.bio || 'New tutor on TutorSphere',
          availability: req.body.availability || [],
          isVerified: false,
          ...req.body
        });

        await tutor.save();
        res.json(tutor);
      }
    } catch (error) {
      console.error("Update tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/tutors/:id", async (req, res) => {
    try {
      const tutor = await Tutor.findOneAndDelete({ id: req.params.id });
      if (tutor) {
        res.json({ message: "Tutor deleted successfully" });
      } else {
        res.status(404).json({ error: "Tutor not found" });
      }
    } catch (error) {
      console.error("Delete tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Review APIs
  app.get("/api/reviews", async (req, res) => {
    try {
      const reviews = await Review.find();
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/reviews/:tutorId", async (req, res) => {
    try {
      const reviews = await Review.find({ tutorId: req.params.tutorId });
      res.json(reviews);
    } catch (error) {
      console.error("Get tutor reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const reviewData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const review = new Review({ ...reviewData, id });
      await review.save();
      res.json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/reviews/:id", async (req, res) => {
    try {
      const review = await Review.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (review) {
        res.json(review);
      } else {
        res.status(404).json({ error: "Review not found" });
      }
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/reviews/:id", async (req, res) => {
    try {
      const review = await Review.findOneAndDelete({ id: req.params.id });
      if (review) {
        res.json({ message: "Review deleted successfully" });
      } else {
        res.status(404).json({ error: "Review not found" });
      }
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Course APIs
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await Course.find();
      res.json(courses);
    } catch (error) {
      console.error("Get courses error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await Course.findOne({ id: req.params.id });
      if (course) {
        res.json(course);
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Get course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/courses", async (req, res) => {
    try {
      const courseData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const course = new Course({ ...courseData, id });
      await course.save();
      res.json(course);
    } catch (error) {
      console.error("Create course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/courses/:id", async (req, res) => {
    try {
      const course = await Course.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (course) {
        res.json(course);
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Update course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const course = await Course.findOneAndDelete({ id: req.params.id });
      if (course) {
        res.json({ message: "Course deleted successfully" });
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Delete course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/courses/:id/enroll", async (req, res) => {
    try {
      const { studentId } = req.body;
      const course = await Course.findOneAndUpdate(
        { id: req.params.id },
        { $addToSet: { enrolledStudents: studentId } },
        { new: true }
      );
      if (course) {
        res.json(course);
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Enroll in course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Resource APIs
  app.get("/api/resources", async (req, res) => {
    try {
      const resources = await Resource.find();
      res.json(resources);
    } catch (error) {
      console.error("Get resources error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/resources", async (req, res) => {
    try {
      const resourceData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const resource = new Resource({ ...resourceData, id });
      await resource.save();
      res.json(resource);
    } catch (error) {
      console.error("Create resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/resources/:id", async (req, res) => {
    try {
      const resource = await Resource.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (resource) {
        res.json(resource);
      } else {
        res.status(404).json({ error: "Resource not found" });
      }
    } catch (error) {
      console.error("Update resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    try {
      const resource = await Resource.findOneAndDelete({ id: req.params.id });
      if (resource) {
        res.json({ message: "Resource deleted successfully" });
      } else {
        res.status(404).json({ error: "Resource not found" });
      }
    } catch (error) {
      console.error("Delete resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Booking APIs
  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await Booking.find();
      res.json(bookings);
    } catch (error) {
      console.error("Get bookings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const bookingData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const booking = new Booking({ ...bookingData, id });
      await booking.save();
      res.json(booking);
    } catch (error) {
      console.error("Create booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await Booking.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (booking) {
        res.json(booking);
      } else {
        res.status(404).json({ error: "Booking not found" });
      }
    } catch (error) {
      console.error("Update booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await Booking.findOneAndDelete({ id: req.params.id });
      if (booking) {
        res.json({ message: "Booking deleted successfully" });
      } else {
        res.status(404).json({ error: "Booking not found" });
      }
    } catch (error) {
      console.error("Delete booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Question APIs
  app.get("/api/questions", async (req, res) => {
    try {
      const questions = await Question.find();
      res.json(questions);
    } catch (error) {
      console.error("Get questions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/questions", async (req, res) => {
    try {
      const questionData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const question = new Question({ ...questionData, id, timestamp: Date.now() });
      await question.save();
      res.json(question);
    } catch (error) {
      console.error("Create question error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/questions/:id", async (req, res) => {
    try {
      const question = await Question.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (question) {
        res.json(question);
      } else {
        res.status(404).json({ error: "Question not found" });
      }
    } catch (error) {
      console.error("Update question error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const question = await Question.findOneAndDelete({ id: req.params.id });
      if (question) {
        res.json({ message: "Question deleted successfully" });
      } else {
        res.status(404).json({ error: "Question not found" });
      }
    } catch (error) {
      console.error("Delete question error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Quiz APIs
  app.get("/api/quizzes", async (req, res) => {
    try {
      const quizzes = await Quiz.find();
      res.json(quizzes);
    } catch (error) {
      console.error("Get quizzes error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/quizzes", async (req, res) => {
    try {
      const quizData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const quiz = new Quiz({ ...quizData, id });
      await quiz.save();
      res.json(quiz);
    } catch (error) {
      console.error("Create quiz error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await Quiz.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (quiz) {
        res.json(quiz);
      } else {
        res.status(404).json({ error: "Quiz not found" });
      }
    } catch (error) {
      console.error("Update quiz error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await Quiz.findOneAndDelete({ id: req.params.id });
      if (quiz) {
        res.json({ message: "Quiz deleted successfully" });
      } else {
        res.status(404).json({ error: "Quiz not found" });
      }
    } catch (error) {
      console.error("Delete quiz error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Study Plan APIs
  app.get("/api/study-plans/:studentId", async (req, res) => {
    try {
      const studyPlan = await StudyPlan.findOne({ studentId: req.params.studentId });
      if (studyPlan) {
        res.json(studyPlan);
      } else {
        res.status(404).json({ error: "Study plan not found" });
      }
    } catch (error) {
      console.error("Get study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/study-plans", async (req, res) => {
    try {
      const studyPlanData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const studyPlan = new StudyPlan({ ...studyPlanData, id });
      await studyPlan.save();
      res.json(studyPlan);
    } catch (error) {
      console.error("Create study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/study-plans/:id", async (req, res) => {
    try {
      const studyPlan = await StudyPlan.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (studyPlan) {
        res.json(studyPlan);
      } else {
        res.status(404).json({ error: "Study plan not found" });
      }
    } catch (error) {
      console.error("Update study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/study-plans/:id", async (req, res) => {
    try {
      const studyPlan = await StudyPlan.findOneAndDelete({ id: req.params.id });
      if (studyPlan) {
        res.json({ message: "Study plan deleted successfully" });
      } else {
        res.status(404).json({ error: "Study plan not found" });
      }
    } catch (error) {
      console.error("Delete study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Skill Level APIs
  app.get("/api/skill-levels/:studentId", async (req, res) => {
    try {
      const skillLevels = await SkillLevel.find({ studentId: req.params.studentId });
      res.json(skillLevels);
    } catch (error) {
      console.error("Get skill levels error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/skill-levels", async (req, res) => {
    try {
      const skillLevelData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const skillLevel = new SkillLevel({ ...skillLevelData, id });
      await skillLevel.save();
      res.json(skillLevel);
    } catch (error) {
      console.error("Create skill level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/skill-levels/:id", async (req, res) => {
    try {
      const skillLevel = await SkillLevel.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (skillLevel) {
        res.json(skillLevel);
      } else {
        res.status(404).json({ error: "Skill level not found" });
      }
    } catch (error) {
      console.error("Update skill level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/skill-levels/:id", async (req, res) => {
    try {
      const skillLevel = await SkillLevel.findOneAndDelete({ id: req.params.id });
      if (skillLevel) {
        res.json({ message: "Skill level deleted successfully" });
      } else {
        res.status(404).json({ error: "Skill level not found" });
      }
    } catch (error) {
      console.error("Delete skill level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: {
            port: 24679, // Use a different port for WebSocket to avoid conflicts
          },
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (error) {
      console.error('Failed to start Vite dev server:', error.message);
      // Continue without Vite middleware - app will still work but without hot reloading
    }
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
