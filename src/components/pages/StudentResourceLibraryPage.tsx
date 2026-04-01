import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Download,
  Eye,
  Heart,
  BookOpen,
  FileText,
  File,
  Star,
  Clock,
  TrendingUp,
  ArrowRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Library,
  Filter,
} from 'lucide-react';
import { Resource } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { SkeletonGrid } from '../common/SkeletonCard';
import { Pagination } from '../common/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = 'popular' | 'newest' | 'title';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StudentResourceLibraryPageProps {
  resources: Resource[];
  isLoggedIn: boolean;
  isLoading: boolean;
  stemSubjects: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getFileTypeIcon = (type: Resource['type']) => {
  switch (type) {
    case 'Paper': return FileText;
    case 'Article': return BookOpen;
    case 'Note': return File;
    default: return FileText;
  }
};

const getFileTypeBadge = (type: Resource['type']): { bg: string; text: string; border: string } => {
  switch (type) {
    case 'Paper': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'Article': return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'Note': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    default: return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
  }
};

const getSimulatedDownloadCount = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % 500 + 10;
};

const getSimulatedFileSize = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 3) - hash + id.charCodeAt(i)) | 0;
  const sizeKB = (Math.abs(hash) % 4000) + 100;
  return sizeKB > 1000 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
};

const getSimulatedRating = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 4) - hash + id.charCodeAt(i)) | 0;
  return Math.round((3.5 + (Math.abs(hash) % 15) / 10) * 10) / 10;
};

const resolveResourceViewUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    if (window.location.port === '3000') {
      return `${window.location.origin}${trimmed}`;
    }
    return `http://localhost:3000${trimmed}`;
  }

  return trimmed;
};

const WISHLIST_KEY = 'tutorsphere_resource_wishlist';
const RECENTLY_VIEWED_KEY = 'tutorsphere_recently_viewed';
const ITEMS_PER_PAGE = 12;

// ─── Local Storage Helpers ────────────────────────────────────────────────────

const loadWishlist = (): Set<string> => {
  try {
    const data = localStorage.getItem(WISHLIST_KEY);
    return data ? new Set(JSON.parse(data)) : new Set();
  } catch { return new Set(); }
};

const saveWishlist = (ids: Set<string>) => {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify([...ids]));
};

const loadRecentlyViewed = (): string[] => {
  try {
    const data = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};

const addToRecentlyViewed = (id: string) => {
  const recent = loadRecentlyViewed().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent.slice(0, 10)));
};

// ─── Horizontal Scroll Section ────────────────────────────────────────────────

const HorizontalSection: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isEmpty?: boolean;
}> = ({ title, icon: Icon, children, isEmpty }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (isEmpty) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
};

// ─── Mini Resource Card (for horizontal scroll) ──────────────────────────────

const MiniResourceCard: React.FC<{
  resource: Resource;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onPreview: () => void;
}> = ({ resource, isWishlisted, onToggleWishlist, onPreview }) => {
  const TypeIcon = getFileTypeIcon(resource.type);
  const badge = getFileTypeBadge(resource.type);

  return (
    <div
      className="min-w-[280px] max-w-[300px] bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-all duration-200 flex-shrink-0 group cursor-pointer"
      onClick={onPreview}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${badge.bg} border ${badge.border} flex items-center justify-center flex-shrink-0`}>
          <TypeIcon className={`w-4 h-4 ${badge.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {resource.title}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            {resource.subject} • {resource.type}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }}
          className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
            isWishlisted
              ? 'text-rose-500 bg-rose-50'
              : 'text-slate-300 hover:text-rose-400 hover:bg-rose-50'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
};

// ─── Resource Card ────────────────────────────────────────────────────────────

const ResourceCard: React.FC<{
  resource: Resource;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onPreview: () => void;
  onDownload: () => void;
}> = ({ resource, isWishlisted, onToggleWishlist, onPreview, onDownload }) => {
  const TypeIcon = getFileTypeIcon(resource.type);
  const badge = getFileTypeBadge(resource.type);
  const downloadCount = getSimulatedDownloadCount(resource.id);
  const fileSize = getSimulatedFileSize(resource.id);
  const rating = getSimulatedRating(resource.id);

  const accentColor = {
    Paper: 'from-blue-500 to-blue-400',
    Article: 'from-purple-500 to-purple-400',
    Note: 'from-emerald-500 to-emerald-400',
  }[resource.type] || 'from-slate-500 to-slate-400';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:border-slate-200 transition-all duration-300 group flex flex-col"
    >
      {/* Accent strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${accentColor}`} />

      <div className="p-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-12 h-12 rounded-xl ${badge.bg} border ${badge.border} flex items-center justify-center flex-shrink-0`}>
            <TypeIcon className={`w-5 h-5 ${badge.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[15px] font-extrabold text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
              {resource.title}
            </h4>
            {resource.description && (
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                {resource.description}
              </p>
            )}
          </div>
        </div>

        {/* Meta badges */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${badge.bg} ${badge.border} ${badge.text}`}>
            {resource.type}
          </span>
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border border-slate-100">
            {resource.subject}
          </span>
          <span className="text-[10px] text-slate-400 font-medium ml-auto">{fileSize}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-5">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-bold text-slate-700">{rating}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{downloadCount} downloads</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 mt-auto pt-4 border-t border-slate-100">
          <button
            onClick={onPreview}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={onDownload}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            onClick={onToggleWishlist}
            className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
              isWishlisted
                ? 'bg-rose-50 text-rose-500 border border-rose-200'
                : 'text-slate-300 hover:bg-rose-50 hover:text-rose-400 border border-transparent hover:border-rose-200'
            }`}
            aria-label={isWishlisted ? 'Remove from saved' : 'Save resource'}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const StudentResourceLibraryPage: React.FC<StudentResourceLibraryPageProps> = ({
  resources,
  isLoggedIn,
  isLoading,
  stemSubjects,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [currentPage, setCurrentPage] = useState(1);
  const [wishlist, setWishlist] = useState<Set<string>>(loadWishlist);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(loadRecentlyViewed);

  // Free resources only
  const freeResources = useMemo(
    () => resources.filter((r) => r.isFree),
    [resources]
  );

  // Recently viewed resources
  const recentlyViewed = useMemo(
    () => recentlyViewedIds
      .map((id) => freeResources.find((r) => r.id === id))
      .filter((r): r is Resource => Boolean(r))
      .slice(0, 6),
    [recentlyViewedIds, freeResources]
  );

  // Recommended resources (top by simulated rating)
  const recommended = useMemo(() => {
    return [...freeResources]
      .sort((a, b) => getSimulatedRating(b.id) - getSimulatedRating(a.id))
      .slice(0, 6);
  }, [freeResources]);

  // Filtered & sorted
  const filteredResources = useMemo(() => {
    let result = freeResources.filter((r) => {
      const matchesSearch = searchQuery === '' ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = subjectFilter === 'All' || r.subject === subjectFilter;
      const matchesType = typeFilter === 'All' || r.type === typeFilter;
      return matchesSearch && matchesSubject && matchesType;
    });

    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => getSimulatedDownloadCount(b.id) - getSimulatedDownloadCount(a.id));
        break;
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'newest':
      default:
        result.sort((a, b) => b.id.localeCompare(a.id));
        break;
    }

    return result;
  }, [freeResources, searchQuery, subjectFilter, typeFilter, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredResources.length / ITEMS_PER_PAGE));
  const paginatedResources = useMemo(
    () => filteredResources.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredResources, currentPage]
  );

  // Wishlist
  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveWishlist(next);
      return next;
    });
  }, []);

  // Preview / Download
  const handleOpenResource = useCallback((resource: Resource) => {
    addToRecentlyViewed(resource.id);
    setRecentlyViewedIds(loadRecentlyViewed());
    if (!resource.url || resource.url === '#') {
      alert('Resource link is not available yet.');
      return;
    }
    const resolvedUrl = resolveResourceViewUrl(resource.url);
    if (!resolvedUrl) {
      alert('Resource link is not available yet.');
      return;
    }
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const resetPage = () => setCurrentPage(1);

  const hasActiveFilters = searchQuery !== '' || subjectFilter !== 'All' || typeFilter !== 'All';

  return (
    <div className="page-container space-y-10">
      {/* ═══ Page Header ═══ */}
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
            <Library className="w-3 h-3" />
            <span>Learning Resources</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Free Resource Library
          </h2>
          <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
            Access tutor-shared papers, notes, and articles to support your studies.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search resources by title or description..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400 shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); resetPage(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ Recently Viewed ═══ */}
      {!isLoading && (
        <HorizontalSection
          title="Recently Viewed"
          icon={Clock}
          isEmpty={recentlyViewed.length === 0}
        >
          {recentlyViewed.map((resource) => (
            <MiniResourceCard
              key={`recent-${resource.id}`}
              resource={resource}
              isWishlisted={wishlist.has(resource.id)}
              onToggleWishlist={() => toggleWishlist(resource.id)}
              onPreview={() => handleOpenResource(resource)}
            />
          ))}
        </HorizontalSection>
      )}

      {/* ═══ Recommended ═══ */}
      {!isLoading && recommended.length > 0 && (
        <HorizontalSection
          title="Recommended Resources"
          icon={Sparkles}
        >
          {recommended.map((resource) => (
            <MiniResourceCard
              key={`rec-${resource.id}`}
              resource={resource}
              isWishlisted={wishlist.has(resource.id)}
              onToggleWishlist={() => toggleWishlist(resource.id)}
              onPreview={() => handleOpenResource(resource)}
            />
          ))}
        </HorizontalSection>
      )}

      {/* ═══ Filters ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        {/* Subject Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {['All', ...stemSubjects].map((s) => (
            <button
              key={s}
              onClick={() => { setSubjectFilter(s); resetPage(); }}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all border ${
                subjectFilter === s
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
              }`}
            >
              {s === 'All' ? 'All Subjects' : s}
            </button>
          ))}
        </div>

        {/* Type + Sort */}
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none hover:border-slate-300"
          >
            <option value="All">All Types</option>
            <option value="Paper">Papers</option>
            <option value="Article">Articles</option>
            <option value="Note">Notes</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortOption); resetPage(); }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none hover:border-slate-300"
          >
            <option value="popular">Most Popular</option>
            <option value="newest">Newest</option>
            <option value="title">A–Z</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">
          {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} found
        </span>
        {hasActiveFilters && (
          <button
            onClick={() => { setSearchQuery(''); setSubjectFilter('All'); setTypeFilter('All'); resetPage(); }}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear all filters
          </button>
        )}
      </div>

      {/* ═══ Resources Grid ═══ */}
      {isLoading ? (
        <SkeletonGrid count={8} variant="resource-card" />
      ) : filteredResources.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No resources found"
          description={
            hasActiveFilters
              ? "We couldn't find any resources matching your filters. Try adjusting your search."
              : "No free resources are available yet. Check back later!"
          }
          actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
          onAction={hasActiveFilters ? () => { setSearchQuery(''); setSubjectFilter('All'); setTypeFilter('All'); resetPage(); } : undefined}
        />
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {paginatedResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                isWishlisted={wishlist.has(resource.id)}
                onToggleWishlist={() => toggleWishlist(resource.id)}
                onPreview={() => handleOpenResource(resource)}
                onDownload={() => handleOpenResource(resource)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ═══ Pagination ═══ */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredResources.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};
