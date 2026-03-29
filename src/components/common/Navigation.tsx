import React from 'react';
import { GraduationCap, User as UserIcon } from 'lucide-react';
import { User } from '../../types';
import { Tab } from '../../data/mockData';

interface NavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  currentUser: User | null;
  setAuthMode: (mode: 'login' | 'signup') => void;
  setShowAuthModal: (show: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  setAuthMode,
  setShowAuthModal
}) => {
  // Define available tabs based on user role
  const getAvailableTabs = () => {
    const baseTabs = [
      { key: 'home' as Tab, label: 'Home' },
      { key: 'tutors' as Tab, label: 'Find Tutors' },
      { key: 'questions' as Tab, label: 'Q&A' },
      { key: 'courses' as Tab, label: 'Courses' },
      { key: 'resources' as Tab, label: 'Resources' },
      { key: 'quizzes' as Tab, label: 'Quizzes' }
    ];

    if (!currentUser) {
      return [
        { key: 'home' as Tab, label: 'Home' },
        { key: 'tutors' as Tab, label: 'Find Tutors' },
        { key: 'courses' as Tab, label: 'Courses' },
        { key: 'resources' as Tab, label: 'Resources' }
      ];
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
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 flex-nowrap">
            {/* Left side: Logo */}
            <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setActiveTab('home')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <GraduationCap className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-indigo-900 whitespace-nowrap">TutorSphere</span>
            </div>

            {/* Center Nav Links */}
            <div className="flex items-center justify-center gap-4 flex-1 flex-nowrap">
              {availableTabs.map(tab => (
                <button 
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)} 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors px-1 ${activeTab === tab.key ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right side: Auth Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {!currentUser ? (
                <>
                  <button
                    onClick={() => {setAuthMode('login'); setShowAuthModal(true)}}
                    className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors px-2 py-2 whitespace-nowrap"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setShowAuthModal(false);
                      setAuthMode('login');
                      setActiveTab('registerSelect');
                    }}
                    className="bg-indigo-600 text-white px-3 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 whitespace-nowrap"
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-full border border-indigo-100 whitespace-nowrap">
                  <UserIcon className="w-4 h-4 shrink-0" /> {currentUser.firstName} {currentUser.lastName}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};