import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Calendar, MessageCircle, Star, GraduationCap, ArrowRight, User } from 'lucide-react';
import { Tab } from '../../data/mockData';
import { User as UserType, Tutor } from '../../types';

interface HomePageProps {
  setActiveTab: (tab: Tab) => void;
  currentUser: UserType | null;
  tutors: Tutor[];
}

export const HomePage: React.FC<HomePageProps> = ({ setActiveTab, currentUser, tutors }) => {
  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="grid lg:grid-cols-2 gap-12 items-center min-h-[70vh] py-12">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">The Future of STEM Learning</span>
          </div>
          <h1 className="text-6xl md:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
            Master STEM with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Expert Tutors</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
            Connect with top-tier educators in all STEM subjects. Personalized learning paths tailored to your needs.
          </p>
          <div className="flex flex-wrap gap-4">
            {currentUser ? (
              <>
                {currentUser.role === 'student' && (
                  <>
                    <button
                      onClick={() => setActiveTab('tutors')}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 group"
                    >
                      Find Your Tutor <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="bg-white text-indigo-600 border border-indigo-200 px-8 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all"
                    >
                      Go to Dashboard
                    </button>
                  </>
                )}
                {currentUser.role === 'tutor' && (
                  <>
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 group"
                    >
                      Tutor Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                      onClick={() => setActiveTab('register')}
                      className="bg-white text-indigo-600 border border-indigo-200 px-8 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all"
                    >
                      Update Profile
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('tutors')}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 group"
                >
                  Find Your Tutor <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className="bg-white text-indigo-600 border border-indigo-200 px-8 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all"
                >
                  Join as Tutor
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-6 pt-4">
            <div className="flex -space-x-3">
              {tutors.slice(0, 4).map(t => (
                <img key={t.id} src={t.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-contain object-center bg-white" referrerPolicy="no-referrer" />
              ))}
            </div>
            <p className="text-sm text-slate-500 font-medium">Joined by <span className="text-slate-900 font-bold">2,000+</span> students this month</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 blur-3xl rounded-full" />
          <div className="relative bg-white p-4 rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200&h=900"
              alt="Learning"
              className="rounded-[2rem] w-full object-cover aspect-[4/3]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-12 left-12 right-12 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/50 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-3 rounded-2xl">
                  <GraduationCap className="text-white w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Live Session</p>
                  <h4 className="font-bold text-slate-900">Advanced Quantum Physics</h4>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Stats */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute -top-6 -right-6 bg-white p-6 rounded-3xl shadow-xl border border-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-xl">
                <CheckCircle className="text-emerald-600 w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">98%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Success Rate</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section - Overlapping Hero */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative -mt-32 z-10 max-w-6xl mx-auto px-6"
      >
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {/* Active Tutors */}
            <div className="text-center space-y-2">
              <div className="text-4xl md:text-5xl font-extrabold text-violet-600">
                {tutors.length}
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Active Tutors
              </div>
            </div>

            {/* Students */}
            <div className="text-center space-y-2">
              <div className="text-4xl md:text-5xl font-extrabold text-violet-600">
                2,000+
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Students
              </div>
            </div>

            {/* STEM/ICT Subjects */}
            <div className="text-center space-y-2">
              <div className="text-4xl md:text-5xl font-extrabold text-violet-600">
                15+
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                STEM/ICT Subjects
              </div>
            </div>

            {/* Average Rating */}
            <div className="text-center space-y-2">
              <div className="text-4xl md:text-5xl font-extrabold text-violet-600">
                4.9
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Average Rating
              </div>
            </div>
          </div>

          {/* Subtle dividers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mt-8">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-8">
        {[
          { icon: <CheckCircle className="text-emerald-500" />, title: 'Verified Tutors', desc: 'Automated qualification validation ensures only the best teach you.' },
          { icon: <Calendar className="text-indigo-500" />, title: 'Easy Booking', desc: 'Seamless time-slot management and session scheduling.' },
          { icon: <MessageCircle className="text-purple-500" />, title: 'Expert Q&A', desc: 'Get instant answers to your STEM questions from our expert community.' }
        ].map((f, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
              {f.icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{f.title}</h3>
            <p className="text-slate-600">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Featured Tutors Section */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-slate-900">Meet Our Top Rated Tutors</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">Learn from the best minds in the country. Our tutors are verified experts with proven track records.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tutors.map(tutor => (
            <motion.div
              whileHover={{ y: -10 }}
              key={tutor.id}
              className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group cursor-pointer"
              onClick={() => setActiveTab('tutors')}
            >
              <div className="relative h-64 overflow-hidden">
                <img src={tutor.avatar} alt={tutor.firstName + ' ' + tutor.lastName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold">{tutor.rating}</span>
                </div>
              </div>
              <div className="p-6 space-y-2">
                <h3 className="font-bold text-lg text-slate-900">{tutor.firstName} {tutor.lastName}</h3>
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">{tutor.subjects[0]}</p>
                <p className="text-sm text-slate-500 line-clamp-1">{tutor.qualifications}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <button
            onClick={() => setActiveTab('tutors')}
            className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:gap-3 transition-all"
          >
            View All Tutors <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
};