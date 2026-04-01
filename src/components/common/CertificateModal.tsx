import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Award, GraduationCap, Calendar, Hash, Share2, CheckCircle } from 'lucide-react';
import { CourseEnrollment } from '../../types';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (enrollment: CourseEnrollment, courseTitle: string) => void;
  enrollment: CourseEnrollment | null;
  courseTitle: string;
  studentName: string;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  onDownload,
  enrollment,
  courseTitle,
  studentName,
}) => {
  if (!enrollment) return null;

  const completionDate = enrollment.completedAt
    ? new Date(enrollment.completedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  const certId = `TS-${enrollment.id?.slice(0, 8).toUpperCase() || 'CERT0001'}`;

  const handleShare = async () => {
    const shareText = `I just earned a TutorSphere certificate for completing "${courseTitle}"! 🎓`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'TutorSphere Certificate', text: shareText });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      alert('Certificate details copied to clipboard!');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 transition-colors shadow-sm certificate-print-hide"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Certificate Container */}
            <div className="certificate-container">
              {/* Top Banner */}
              <div className="relative h-32 sm:h-40 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 overflow-hidden flex items-center justify-center">
                {/* Pattern Overlay */}
                <div className="absolute inset-0 opacity-10">
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="cert-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <circle cx="20" cy="20" r="1" fill="white" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#cert-pattern)" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
                
                {/* Logo + Title */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-white/20 backdrop-blur p-2 rounded-xl">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-white/90 font-bold text-sm tracking-wider uppercase">TutorSphere</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Certificate of Completion
                  </h2>
                </div>
              </div>

              {/* Certificate Body */}
              <div className="px-6 sm:px-12 py-8 sm:py-12 text-center bg-gradient-to-b from-slate-50/80 to-white relative">
                {/* Decorative corners */}
                <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-indigo-200 rounded-tl-xl" />
                <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-indigo-200 rounded-tr-xl" />
                <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-indigo-200 rounded-bl-xl" />
                <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-indigo-200 rounded-br-xl" />

                {/* Awarded to */}
                <p className="text-slate-400 font-semibold uppercase tracking-[0.25em] text-xs sm:text-sm mb-3">
                  This is awarded to
                </p>

                {/* Student Name */}
                <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-6 leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {studentName}
                </h3>

                {/* Completion Text */}
                <p className="text-slate-500 font-medium text-sm sm:text-base mb-3 max-w-lg mx-auto">
                  for successfully completing the course
                </p>

                {/* Course Title */}
                <h4 className="text-xl sm:text-2xl font-bold text-indigo-700 mb-8 leading-snug max-w-lg mx-auto">
                  "{courseTitle}"
                </h4>

                {/* Seal */}
                <div className="flex justify-center mb-8">
                  <div className="relative">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-2 border-amber-200 flex items-center justify-center">
                        <Award className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow" />
                      </div>
                    </div>
                    <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-1 border-2 border-white shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 font-medium">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>{completionDate}</span>
                  </div>
                  <div className="w-px h-4 bg-slate-200 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono text-xs">{certId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 sm:px-12 py-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-center gap-3 certificate-print-hide">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
              >
                Close
              </button>
              <button
                onClick={handleShare}
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-indigo-100 text-indigo-600 font-bold hover:bg-indigo-50 transition-all text-sm flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button
                onClick={() => onDownload(enrollment, courseTitle)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
