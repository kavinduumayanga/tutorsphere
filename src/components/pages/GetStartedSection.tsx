import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, BookOpen, CheckCircle, X, User as UserIcon, Lock, Mail, ArrowRight } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { localService } from '../../services/localService';
import { User, Tutor } from '../../types';

interface GetStartedSectionProps {
  onAccountCreated: (user: User) => void;
  STEM_SUBJECTS: string[];
  initialRole?: 'student' | 'tutor';
  showRoleSelector?: boolean;
  onBack?: () => void;
}

export const GetStartedSection: React.FC<GetStartedSectionProps> = ({
  onAccountCreated,
  STEM_SUBJECTS,
  initialRole = 'student',
  showRoleSelector = true,
  onBack
}) => {
  const [role, setRole] = useState<'student' | 'tutor'>(initialRole);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    education: '',
    subjects: [] as string[],
    teachingLevel: 'Undergraduate',
    hourlyRate: 50
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<{isValid: boolean; reason: string} | null>(null);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  const heading = showRoleSelector
    ? 'Create Account'
    : role === 'tutor'
      ? 'Create Tutor Account'
      : 'Create Student Account';
  const subtitle = showRoleSelector
    ? 'Join our elite network of learners and educators. Choose your path below to begin your journey.'
    : role === 'tutor'
      ? 'Tell us about your expertise and start sharing your knowledge.'
      : 'Start learning with expert tutors and AI-powered support.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (role === 'tutor') {
        const result = await localService.validateTutor(formData as any);
        setValidationResult(result);
        if (!result.isValid) {
          setIsSubmitting(false);
          return;
        }
      }

      // Real auth submission
      const user = await apiService.signup(formData.firstName, formData.lastName, formData.email, formData.password, role);
      
      // If it's a tutor, maybe it sets it up via mock locally, but for the MVP:
      onAccountCreated(user);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 mb-4"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to role selection
          </button>
        )}
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">{heading}</h2>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          {subtitle}
        </p>
      </div>

      {showRoleSelector && (
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setRole('student')}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all text-lg ${
              role === 'student' 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-105' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <GraduationCap className={role === 'student' ? 'text-white' : 'text-slate-400'} size={24} />
            Student Registration
          </button>
          <button
            onClick={() => setRole('tutor')}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all text-lg ${
              role === 'tutor' 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-105' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BookOpen className={role === 'tutor' ? 'text-white' : 'text-slate-400'} size={24} />
            Tutor Registration
          </button>
        </div>
      )}

      <motion.div
        key={role}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">First Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="text"
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="John"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Last Name</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="text"
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="Doe"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                required
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {role === 'tutor' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                <div className="h-px w-full bg-slate-100 my-8" />
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Education Details</label>
                  <textarea
                    required
                    value={formData.education}
                    onChange={e => setFormData({...formData, education: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 h-24 bg-slate-50 focus:bg-white"
                    placeholder="e.g. BSc in Computer Science, University of Colombo"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Subjects (STEM/ICT Only)</label>
                  <div className="flex flex-wrap gap-2">
                    {STEM_SUBJECTS.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const newSubs = formData.subjects.includes(s)
                            ? formData.subjects.filter(x => x !== s)
                            : [...formData.subjects, s];
                          setFormData({...formData, subjects: newSubs});
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                          formData.subjects.includes(s)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Teaching Level</label>
                    <select
                      value={formData.teachingLevel}
                      onChange={e => setFormData({...formData, teachingLevel: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                    >
                      <option value="A/L">A/L</option>
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Hourly Rate ($)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      value={formData.hourlyRate}
                      onChange={e => setFormData({...formData, hourlyRate: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-medium text-sm text-center">
              {error}
            </div>
          )}

          {validationResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 rounded-xl border ${validationResult.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {validationResult.isValid ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
                {validationResult.isValid ? 'Validation Successful' : 'Validation Failed'}
              </div>
              <p className="text-sm opacity-90">{validationResult.reason}</p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (role === 'tutor' && formData.subjects.length === 0)}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/20 text-lg group"
          >
            {isSubmitting ? 'Processing...' : role === 'tutor' ? 'Submit Application' : 'Create Account'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
