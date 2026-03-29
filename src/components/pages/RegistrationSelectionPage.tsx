import React from 'react';
import { GraduationCap, BookOpen, ArrowRight } from 'lucide-react';

interface RegistrationSelectionPageProps {
  onSelectRole: (role: 'student' | 'tutor') => void;
}

export const RegistrationSelectionPage: React.FC<RegistrationSelectionPageProps> = ({ onSelectRole }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Sign Up</h2>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Choose the path that fits you best. Register as a student or apply to become a tutor.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <button
          type="button"
          onClick={() => onSelectRole('student')}
          className="group text-left bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-indigo-200 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200">
              <GraduationCap className="w-7 h-7" />
            </div>
            <ArrowRight className="w-6 h-6 text-indigo-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-6">Student Registration</h3>
          <p className="text-slate-500 mt-3">
            Access expert tutors, AI-powered study plans, and curated learning resources.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectRole('tutor')}
          className="group text-left bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-indigo-200 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg shadow-slate-300">
              <BookOpen className="w-7 h-7" />
            </div>
            <ArrowRight className="w-6 h-6 text-indigo-600 group-hover:translate-x-1 transition-transform" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mt-6">Tutor Registration</h3>
          <p className="text-slate-500 mt-3">
            Share your expertise, grow your student base, and manage bookings in one place.
          </p>
        </button>
      </div>
    </div>
  );
};
