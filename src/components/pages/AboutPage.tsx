import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Search, CalendarClock, BookOpen, Bot, Star, Target, Lightbulb, Users, CheckCircle2 } from 'lucide-react';
import { Tab } from '../../data/mockData';

interface AboutPageProps {
  setActiveTab: (tab: Tab) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ setActiveTab }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24 bg-white/50">
      
      {/* Article Header */}
      <article className="space-y-8 max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-indigo-600 font-bold tracking-widest uppercase text-sm"
        >
          About Our Platform
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight border-b-4 border-indigo-600 pb-6 inline-block"
        >
          The Story of TutorSphere
        </motion.h1>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="prose prose-lg text-slate-600 prose-indigo"
        >
          <p className="lead text-2xl font-medium text-slate-800">
            We built TutorSphere because finding quality STEM and ICT education in Sri Lanka shouldn't be a game of chance on social media.
          </p>
          <p>
            TutorSphere is a comprehensive, web-based tutor and course booking ecosystem designed strictly for Science, Technology, Engineering, Mathematics, and ICT. We act as the bridge connecting ambitious students directly with highly qualified, verified educators in a structured environment.
          </p>
        </motion.div>
      </article>

      {/* Vision & Mission Split */}
      <section className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
        <div className="bg-indigo-50 border-l-4 border-indigo-600 p-8 rounded-r-2xl">
          <Target className="w-8 h-8 text-indigo-600 mb-4" />
          <h3 className="text-2xl font-bold text-slate-900 mb-3">Our Mission</h3>
          <p className="text-slate-700">
            To organize Sri Lanka's fragmented tutoring landscape by providing a single, trustworthy hub where credentials matter, scheduling is seamless, and student progress is the ultimate priority.
          </p>
        </div>
        <div className="bg-violet-50 border-l-4 border-violet-600 p-8 rounded-r-2xl">
          <Lightbulb className="w-8 h-8 text-violet-600 mb-4" />
          <h3 className="text-2xl font-bold text-slate-900 mb-3">Our Vision</h3>
          <p className="text-slate-700">
            To become the indisputable standard for STEM and ICT talent development, empowering the next generation of technologists, scientists, and engineers across the nation.
          </p>
        </div>
      </section>

      {/* The Problem we Solve (Narrative format) */}
      <section className="bg-slate-900 text-white p-12 md:p-16 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold mb-8">Why We Exist</h2>
          <div className="space-y-4 text-slate-300">
            <p>
              Historically, the Sri Lankan tutoring market has operated in a state of organized chaos. Students and parents spend hours scrolling through unverified Facebook groups or relying on word-of-mouth. 
            </p>
            <ul className="space-y-3 py-4">
              <li className="flex gap-3 items-start"><CheckCircle2 className="w-6 h-6 text-rose-400 shrink-0" /> <span><strong>No verification:</strong> Anyone can claim to be an expert online.</span></li>
              <li className="flex gap-3 items-start"><CheckCircle2 className="w-6 h-6 text-rose-400 shrink-0" /> <span><strong>Scheduling nightmares:</strong> Endless WhatsApp messages just to book an hour.</span></li>
              <li className="flex gap-3 items-start"><CheckCircle2 className="w-6 h-6 text-rose-400 shrink-0" /> <span><strong>Zero infrastructure:</strong> No central place for notes, assignments, or progressive tracking.</span></li>
            </ul>
            <p className="text-xl font-medium text-white italic mt-6 border-l-2 border-indigo-500 pl-4">
              "We realized that learning is hard enough. Finding someone to learn from should be the easy part."
            </p>
          </div>
        </div>
      </section>

      {/* Feature Breakdown List */}
      <section className="max-w-4xl mx-auto space-y-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">How We Solve It</h2>
          <p className="text-slate-600">The core mechanics that make TutorSphere work.</p>
        </div>

        <div className="space-y-12">
          <div className="flex gap-6 items-start">
            <div className="bg-indigo-100 p-4 rounded-full shrink-0">
              <ShieldCheck className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Automated Qualification Validation</h4>
              <p className="text-slate-600">Tutors cannot simply sign up and teach. Our registration process mandates evidence of qualifications, ensuring that when you select a STEM or ICT tutor, you are getting a vetted professional.</p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="bg-indigo-100 p-4 rounded-full shrink-0">
              <Search className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Precision Discovery</h4>
              <p className="text-slate-600">No more endless scrolling. Use our advanced filtering mechanics to find tutors based specifically on your exact STEM subject requirements, skill level, and budget.</p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="bg-indigo-100 p-4 rounded-full shrink-0">
              <CalendarClock className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Bulletproof Scheduling</h4>
              <p className="text-slate-600">Our native time-slot management system completely prevents double-booking. View a tutor's live availability, book instantly, and track all your upcoming sessions on a unified dashboard.</p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="bg-indigo-100 p-4 rounded-full shrink-0">
              <BookOpen className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Complete Course Ecosystem</h4>
              <p className="text-slate-600">Beyond 1-on-1 tutoring, we host structured courses. Enrolled students gain access to free global resources, structured curriculums, and verifiable certificate generation upon completion.</p>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="bg-indigo-100 p-4 rounded-full shrink-0">
              <Bot className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">AI-Powered Continuity</h4>
              <p className="text-slate-600">Learning doesn't stop when the session ends. Our integrated AI chatbot acts as a 24/7 teaching assistant, ready to help breakdown complex ICT logic or physics formulas at any hour.</p>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* Simple CTA */}
      <section className="text-center space-y-6 pb-10">
        <Users className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">Be Part of the Ecosystem</h2>
        <div className="flex justify-center gap-4 pt-4">
          <button 
            onClick={() => setActiveTab('tutors')}
            className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors px-4 py-2"
          >
            Find Tutors →
          </button>
          <span className="text-slate-300 py-2">|</span>
          <button 
            onClick={() => setActiveTab('registerSelect')}
            className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors px-4 py-2"
          >
            Register to Teach →
          </button>
        </div>
      </section>

    </div>
  );
};
