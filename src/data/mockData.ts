import { Tutor, Review, Course, Resource } from '../types';

export const MOCK_TUTORS: Tutor[] = [
  {
    id: 't1',
    firstName: 'Dr. Aruni',
    lastName: 'Perera',
    email: 'aruni@example.com',
    role: 'tutor',
    qualifications: 'PhD in Computer Science',
    subjects: ['Tech', 'Engineering'],
    teachingLevel: 'University',
    pricePerHour: 2500,
    rating: 4.9,
    reviewCount: 124,
    bio: 'Expert in algorithms and web development with 10 years of experience.',
    isVerified: true,
    availability: [
      { id: 's1', day: 'Monday', startTime: '10:00', endTime: '11:00', isBooked: false },
      { id: 's2', day: 'Wednesday', startTime: '14:00', endTime: '15:00', isBooked: false }
    ],
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400'
  },
  {
    id: 't2',
    firstName: 'Mr. Kamal',
    lastName: 'Silva',
    email: 'kamal@example.com',
    role: 'tutor',
    qualifications: 'BSc in Mathematics',
    subjects: ['Maths', 'Science'],
    teachingLevel: 'School',
    pricePerHour: 1500,
    rating: 4.7,
    reviewCount: 89,
    bio: 'Passionate math tutor helping students excel in A/L exams.',
    isVerified: true,
    availability: [
      { id: 's3', day: 'Tuesday', startTime: '16:00', endTime: '17:00', isBooked: false }
    ],
    avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&q=80&w=400&h=400'
  },
  {
    id: 't3',
    firstName: 'Ms. Dilini',
    lastName: 'Fernando',
    email: 'dilini@example.com',
    role: 'tutor',
    qualifications: 'MSc in Applied Physics',
    subjects: ['Science', 'Maths'],
    teachingLevel: 'School and University',
    pricePerHour: 1800,
    rating: 4.8,
    reviewCount: 56,
    bio: 'Specialized in mechanics and electronics. I make physics fun and easy to understand.',
    isVerified: true,
    availability: [
      { id: 's4', day: 'Friday', startTime: '17:00', endTime: '18:00', isBooked: false }
    ],
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400&h=400'
  },
  {
    id: 't4',
    firstName: 'Dr. Sameera',
    lastName: 'Bandara',
    email: 'sameera@example.com',
    role: 'tutor',
    qualifications: 'PhD in Organic Chemistry',
    subjects: ['Science'],
    teachingLevel: 'University',
    pricePerHour: 3000,
    rating: 5.0,
    reviewCount: 42,
    bio: 'Dedicated to helping university students master complex organic reactions.',
    isVerified: true,
    availability: [
      { id: 's5', day: 'Saturday', startTime: '09:00', endTime: '10:00', isBooked: false }
    ],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400'
  }
];

export const MOCK_REVIEWS: Review[] = [
  { id: 'rev1', tutorId: 't1', studentId: 's1', studentName: 'Nimal Perera', rating: 5, comment: 'Amazing teaching! Very clear and helpful.', date: '2024-02-15' },
  { id: 'rev2', tutorId: 't2', studentId: 's2', studentName: 'Saman Kumara', rating: 4, comment: 'Good tutor, but sometimes a bit fast.', date: '2024-02-10' }
];

export const MOCK_COURSES: Course[] = [
  {
    id: 'c1',
    tutorId: 't1',
    title: 'Advanced Web Development with React',
    subject: 'ICT',
    description: 'Master modern frontend development with React, TypeScript, and Tailwind CSS.',
    isFree: true,
    price: 0,
    thumbnail: 'https://picsum.photos/seed/react/400/250',
    modules: [
      {
        id: 'm1',
        title: 'Introduction to React',
        videoUrl: '#',
        resources: [{ name: 'Notes.pdf', url: '#' }],
      },
      {
        id: 'm2',
        title: 'State Management',
        videoUrl: '#',
        resources: [{ name: 'State.pdf', url: '#' }],
      },
      {
        id: 'm3',
        title: 'Advanced Hooks and Context API',
        videoUrl: '#',
        resources: [{ name: 'Hooks.pdf', url: '#' }],
      },
      {
        id: 'm4',
        title: 'Testing React Applications',
        videoUrl: '#',
        resources: [{ name: 'Testing.pdf', url: '#' }],
      },
    ],
    enrolledStudents: ['s1']
  },
  {
    id: 'c2',
    tutorId: 't2',
    title: 'Pure Mathematics for A/L',
    subject: 'Mathematics',
    description: 'Complete guide to A/L Pure Mathematics with past paper discussions.',
    isFree: true,
    price: 0,
    thumbnail: 'https://picsum.photos/seed/math/400/250',
    modules: [
      {
        id: 'm1',
        title: 'Calculus Basics',
        videoUrl: '#',
        resources: [{ name: 'Calculus.pdf', url: '#' }],
      },
    ],
    enrolledStudents: []
  }
];

export const MOCK_RESOURCES: Resource[] = [
  {
    id: 'r1',
    tutorId: 't1',
    title: 'A/L ICT Past Paper 2023',
    type: 'Paper',
    subject: 'ICT',
    url: '#',
    description: 'Solved past paper with marking scheme and model answers.',
    isFree: true,
    downloadCount: 128,
  },
  {
    id: 'r2',
    tutorId: 't3',
    title: 'Physics Mechanics Notes',
    type: 'Note',
    subject: 'Physics',
    url: '#',
    description: 'Concise theory notes and worked examples for mechanics.',
    isFree: true,
    downloadCount: 74,
  }
];

export const STEM_SUBJECTS = ['Maths', 'Science', 'Engineering', 'Tech', 'ICT'];

export type Tab = 'home' | 'tutors' | 'questions' | 'courses' | 'resources' | 'quizzes' | 'registerSelect' | 'registerStudent' | 'registerTutor' | 'register' | 'dashboard' | 'about';