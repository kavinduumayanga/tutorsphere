import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Star,
  CheckCircle,
  Filter,
  ChevronDown,
  X,
  SlidersHorizontal,
  Users,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';
import { Tutor } from '../../types';
import { SkeletonGrid } from '../common/SkeletonCard';
import { EmptyState } from '../common/EmptyState';
import { Pagination } from '../common/Pagination';

interface FindTutorsPageProps {
  tutors: Tutor[];
  isLoading: boolean;
  stemSubjects: string[];
  onViewProfile: (tutorId: string) => void;
}

type SortOption = 'popular' | 'rating' | 'price-low' | 'price-high' | 'newest';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'price-low', label: 'Price: Low → High' },
  { value: 'price-high', label: 'Price: High → Low' },
  { value: 'newest', label: 'Newest' },
];

const LEVEL_OPTIONS = ['All Levels', 'School', 'University', 'Both'];

const ITEMS_PER_PAGE = 9;

const getTutorDisplayName = (tutor: Tutor): string => {
  const name = (tutor as any).name;
  if (name) return name;
  return `${tutor.firstName || ''} ${tutor.lastName || ''}`.trim() || 'Tutor';
};

export const FindTutorsPage: React.FC<FindTutorsPageProps> = ({
  tutors,
  isLoading,
  stemSubjects,
  onViewProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [levelFilter, setLevelFilter] = useState<string>('All Levels');
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filtering
  const filteredTutors = useMemo(() => {
    let result = [...tutors];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          getTutorDisplayName(t).toLowerCase().includes(q) ||
          t.subjects.some((s) => s.toLowerCase().includes(q)) ||
          t.qualifications?.toLowerCase().includes(q) ||
          t.bio?.toLowerCase().includes(q)
      );
    }

    // Subject
    if (subjectFilter !== 'All') {
      result = result.filter((t) => t.subjects.includes(subjectFilter));
    }

    // Level
    if (levelFilter !== 'All Levels') {
      result = result.filter((t) => t.teachingLevel === levelFilter || t.teachingLevel === 'Both');
    }

    // Rating
    if (ratingFilter > 0) {
      result = result.filter((t) => t.rating >= ratingFilter);
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'price-low':
        result.sort((a, b) => a.pricePerHour - b.pricePerHour);
        break;
      case 'price-high':
        result.sort((a, b) => b.pricePerHour - a.pricePerHour);
        break;
      case 'newest':
        result.reverse();
        break;
      case 'popular':
      default:
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
    }

    return result;
  }, [tutors, searchQuery, subjectFilter, levelFilter, ratingFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredTutors.length / ITEMS_PER_PAGE);
  const paginatedTutors = filteredTutors.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const activeFilterCount = [
    subjectFilter !== 'All',
    levelFilter !== 'All Levels',
    ratingFilter > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSubjectFilter('All');
    setLevelFilter('All Levels');
    setRatingFilter(0);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-[2.5rem] p-8 sm:p-12 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur rounded-full text-xs font-bold text-white/90 uppercase tracking-widest mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Verified STEM & ICT Experts
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-3">
            Find Your Perfect Tutor
          </h1>
          <p className="text-indigo-100/80 text-base sm:text-lg max-w-xl font-medium mb-8">
            Browse verified experts ready to guide you through personalized learning paths.
          </p>

          {/* Search Bar */}
          <div className="flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="tutor-search"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, subject, or expertise..."
                className="w-full pl-13 pr-10 py-4 rounded-2xl bg-white border-0 text-slate-900 font-medium focus:ring-4 focus:ring-white/30 outline-none transition-all placeholder:text-slate-400 shadow-xl shadow-indigo-900/20"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-5 py-4 rounded-2xl font-bold text-sm transition-all shadow-xl relative ${
                showFilters
                  ? 'bg-white text-indigo-600'
                  : 'bg-white/15 backdrop-blur text-white hover:bg-white/25'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-indigo-500" />
                  Filter Tutors
                </h3>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-6">
                {/* Subject Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                  <div className="flex flex-wrap gap-2">
                    {['All', ...stemSubjects].map((subject) => (
                      <button
                        key={subject}
                        onClick={() => {
                          setSubjectFilter(subject);
                          setCurrentPage(1);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                          subjectFilter === subject
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        {subject}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Level</label>
                  <div className="relative">
                    <select
                      value={levelFilter}
                      onChange={(e) => {
                        setLevelFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                    >
                      {LEVEL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Rating Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Minimum Rating</label>
                  <div className="flex gap-2">
                    {[0, 3, 3.5, 4, 4.5].map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setRatingFilter(r);
                          setCurrentPage(1);
                        }}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                          ratingFilter === r
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-amber-200'
                        }`}
                      >
                        {r === 0 ? (
                          'Any'
                        ) : (
                          <>
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {r}+
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sort Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-500">
          <span className="font-bold text-slate-900">{filteredTutors.length}</span> tutor{filteredTutors.length !== 1 ? 's' : ''} found
        </p>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Sort by</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white appearance-none pr-9 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonGrid count={6} variant="tutor-card" columns="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" />
      ) : paginatedTutors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tutors match your criteria"
          description="Try adjusting your search or filters to find available tutors."
          actionLabel="Clear All Filters"
          onAction={clearAllFilters}
        />
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {paginatedTutors.map((tutor) => (
              <motion.div
                layout
                whileHover={{ y: -8 }}
                key={tutor.id}
                className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 transition-all group relative"
              >
                {/* Gradient Background Strip */}
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-10" />

                <div className="p-8 relative z-10">
                  {/* Profile Header */}
                  <div className="flex items-start gap-5">
                    <div className="relative">
                      {tutor.avatar ? (
                        <img
                          src={tutor.avatar}
                          alt={getTutorDisplayName(tutor)}
                          className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-xl"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 border-4 border-white shadow-xl flex items-center justify-center text-white text-2xl font-black">
                          {getTutorDisplayName(tutor).charAt(0)}
                        </div>
                      )}
                      {tutor.isVerified && (
                        <div className="absolute -bottom-1 -right-1 bg-indigo-600 p-1 rounded-lg border-2 border-white">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 pt-1 min-w-0">
                      <h3 className="font-black text-xl text-slate-900 leading-tight mb-1 truncate">
                        {getTutorDisplayName(tutor)}
                      </h3>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest truncate">
                        {tutor.qualifications}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-black text-amber-700">{tutor.rating}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          ({tutor.reviewCount} reviews)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Subjects */}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {tutor.subjects.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-100"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  {/* Bio */}
                  <p className="mt-5 text-sm text-slate-500 leading-relaxed line-clamp-2 font-medium italic">
                    "{tutor.bio}"
                  </p>

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hourly Rate</span>
                      <p className="text-2xl font-black text-slate-900">LKR {tutor.pricePerHour}</p>
                    </div>
                    <button
                      onClick={() => onViewProfile(tutor.id)}
                      className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredTutors.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};
