import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, User as UserIcon, Menu, X } from 'lucide-react';
import { User } from '../../types';
import { Tab } from '../../data/mockData';

interface NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  currentUser: User | null;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  setAuthMode: (mode: 'login' | 'signup') => void;
  setShowAuthModal: (show: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  isMenuOpen,
  setIsMenuOpen,
  setAuthMode,
  setShowAuthModal
}) => {
  // Define available tabs based on user role
  const getAvailableTabs = () => {
    const baseTabs = [
      { key: 'home' as Tab, label: 'Home' },
      { key: 'tutors' as Tab, label: 'Tutors' },
      { key: 'questions' as Tab, label: 'Q&A' },
      { key: 'courses' as Tab, label: 'Courses' },
      { key: 'resources' as Tab, label: 'Resources' },
      { key: 'quizzes' as Tab, label: 'Quizzes' }
    ];

    if (!currentUser) {
      return baseTabs;
    }

    // Students can access all tabs plus profile
    if (currentUser.role === 'student') {
      return [...baseTabs, { key: 'register' as Tab, label: 'My Profile' }, { key: 'dashboard' as Tab, label: 'Dashboard' }];
    }

    // Tutors can access all tabs plus register (for managing their profile)
    if (currentUser.role === 'tutor') {
      return [...baseTabs, { key: 'register' as Tab, label: 'My Profile' }, { key: 'dashboard' as Tab, label: 'Dashboard' }];
    }

    return baseTabs;
  };

  const availableTabs = getAvailableTabs();
  return (
    <>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <GraduationCap className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-indigo-900">TutorSphere</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {availableTabs.map(tab => (
                <button 
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)} 
                  className={`text-sm font-semibold ${activeTab === tab.key ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
                >
                  {tab.label}
                </button>
              ))}
              {!currentUser ? (
                <button
                  onClick={() => {setAuthMode('login'); setShowAuthModal(true)}}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Login
                </button>
              ) : (
                <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                  <UserIcon className="w-4 h-4" /> {currentUser.firstName} {currentUser.lastName}
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-4"
          >
            {availableTabs.map(tab => (
              <button 
                key={tab.key}
                onClick={() => {setActiveTab(tab.key); setIsMenuOpen(false)}} 
                className="block w-full text-left text-slate-600 font-medium"
              >
                {tab.label}
              </button>
            ))}
            {!currentUser && (
              <button onClick={() => {setActiveTab('register'); setIsMenuOpen(false)}} className="block w-full text-left text-indigo-600 font-bold">Become a Tutor</button>
            )}
            {!currentUser ? (
              <button
                onClick={() => {setAuthMode('login'); setShowAuthModal(true); setIsMenuOpen(false)}}
                className="w-full bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-bold"
              >
                Login
              </button>
            ) : (
              <button onClick={() => {setActiveTab('dashboard'); setIsMenuOpen(false)}} className="w-full bg-indigo-50 text-indigo-700 px-5 py-3 rounded-xl text-sm font-bold">
                Dashboard
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};