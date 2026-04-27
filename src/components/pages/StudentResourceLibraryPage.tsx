import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  X,
  Download,
  Eye,
  Heart,
  BookOpen,
  BookMarked,
  Sparkles,
  Loader2,
  ExternalLink,
  Globe,
  GraduationCap,
  Shield,
  FileText,
  File,
  Star,
  Library,
} from 'lucide-react';
import { Resource } from '../../types';
import { apiService, type TrustedResourceFinderItem } from '../../services/apiService';
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

  return trimmed;
};

const getResourceIdentifier = (resource: Resource): string => {
  const idCandidate = String((resource as any)?.id ?? (resource as any)?._id ?? '').trim();
  if (idCandidate) {
    return idCandidate;
  }

  const fallback = String(resource.url || resource.title || '').trim();
  return fallback;
};

const getResourceTimestamp = (resource: Resource): number => {
  const createdAt = Date.parse(String((resource as any).createdAt || ''));
  if (!Number.isNaN(createdAt)) {
    return createdAt;
  }

  const updatedAt = Date.parse(String((resource as any).updatedAt || ''));
  if (!Number.isNaN(updatedAt)) {
    return updatedAt;
  }

  return 0;
};

const TRUSTED_FINDER_URL_FALLBACK = 'https://developer.mozilla.org/';

const normalizeTrustedFinderUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return TRUSTED_FINDER_URL_FALLBACK;
  }

  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return TRUSTED_FINDER_URL_FALLBACK;
    }

    return parsed.toString();
  } catch {
    return TRUSTED_FINDER_URL_FALLBACK;
  }
};

const getTrustedResourceVisual = (resource: TrustedResourceFinderItem) => {
  const descriptor = `${resource.title} ${resource.source} ${resource.type}`.toLowerCase();

  if (descriptor.includes('kubernetes') || descriptor.includes('k8s')) {
    return {
      Icon: Library,
      badge: 'K8s',
      bgClass: 'bg-sky-50',
      borderClass: 'border-sky-200',
      iconClass: 'text-sky-700',
      badgeClass: 'bg-sky-100 text-sky-700',
    };
  }

  if (descriptor.includes('docker')) {
    return {
      Icon: Library,
      badge: 'Docker',
      bgClass: 'bg-cyan-50',
      borderClass: 'border-cyan-200',
      iconClass: 'text-cyan-700',
      badgeClass: 'bg-cyan-100 text-cyan-700',
    };
  }

  if (descriptor.includes('aws')) {
    return {
      Icon: Globe,
      badge: 'AWS',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
      iconClass: 'text-amber-700',
      badgeClass: 'bg-amber-100 text-amber-700',
    };
  }

  if (descriptor.includes('google')) {
    return {
      Icon: Globe,
      badge: 'Google',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
      iconClass: 'text-emerald-700',
      badgeClass: 'bg-emerald-100 text-emerald-700',
    };
  }

  if (descriptor.includes('microsoft')) {
    return {
      Icon: BookMarked,
      badge: 'MS Learn',
      bgClass: 'bg-indigo-50',
      borderClass: 'border-indigo-200',
      iconClass: 'text-indigo-700',
      badgeClass: 'bg-indigo-100 text-indigo-700',
    };
  }

  if (descriptor.includes('github') || descriptor.includes('code')) {
    return {
      Icon: FileText,
      badge: 'Code',
      bgClass: 'bg-slate-50',
      borderClass: 'border-slate-200',
      iconClass: 'text-slate-700',
      badgeClass: 'bg-slate-200 text-slate-700',
    };
  }

  if (descriptor.includes('certification') || descriptor.includes('training')) {
    return {
      Icon: Shield,
      badge: 'Training',
      bgClass: 'bg-teal-50',
      borderClass: 'border-teal-200',
      iconClass: 'text-teal-700',
      badgeClass: 'bg-teal-100 text-teal-700',
    };
  }

  if (descriptor.includes('book')) {
    return {
      Icon: BookOpen,
      badge: 'Book',
      bgClass: 'bg-rose-50',
      borderClass: 'border-rose-200',
      iconClass: 'text-rose-700',
      badgeClass: 'bg-rose-100 text-rose-700',
    };
  }

  if (descriptor.includes('tutorsphere')) {
    return {
      Icon: Library,
      badge: 'TutorSphere',
      bgClass: 'bg-violet-50',
      borderClass: 'border-violet-200',
      iconClass: 'text-violet-700',
      badgeClass: 'bg-violet-100 text-violet-700',
    };
  }

  return {
    Icon: GraduationCap,
    badge: 'Trusted',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    iconClass: 'text-indigo-700',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  };
};

const WISHLIST_KEY = 'tutorsphere_resource_wishlist';
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

// ─── Resource Card ────────────────────────────────────────────────────────────

const ResourceCard: React.FC<{
  resource: Resource;
  downloadCount: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onPreview: () => void;
  onDownload: () => void;
}> = ({ resource, downloadCount, isWishlisted, onToggleWishlist, onPreview, onDownload }) => {
  const TypeIcon = getFileTypeIcon(resource.type);
  const badge = getFileTypeBadge(resource.type);
  const resourceIdentity = getResourceIdentifier(resource) || `${resource.subject}-${resource.type}`;
  const fileSize = getSimulatedFileSize(resourceIdentity);
  const rating = getSimulatedRating(resourceIdentity);

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
  const [downloadOverrides, setDownloadOverrides] = useState<Record<string, number>>({});
  const [trustedTopicInput, setTrustedTopicInput] = useState('');
  const [trustedTopicResult, setTrustedTopicResult] = useState('');
  const [trustedResources, setTrustedResources] = useState<TrustedResourceFinderItem[]>([]);
  const [trustedFinderLoading, setTrustedFinderLoading] = useState(false);
  const [trustedFinderError, setTrustedFinderError] = useState<string | null>(null);
  const [trustedFinderHasSearched, setTrustedFinderHasSearched] = useState(false);

  const resolveDownloadCount = useCallback((resource: Resource): number => {
    const resourceKey = getResourceIdentifier(resource);
    const value = (resourceKey ? downloadOverrides[resourceKey] : undefined) ?? resource.downloadCount;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }, [downloadOverrides]);

  // Free resources only
  const freeResources = useMemo(
    () => resources.filter((r) => r.isFree),
    [resources]
  );

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
        result.sort((a, b) => resolveDownloadCount(b) - resolveDownloadCount(a));
        break;
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'newest':
      default:
        result.sort((a, b) => {
          const timeDelta = getResourceTimestamp(b) - getResourceTimestamp(a);
          if (timeDelta !== 0) {
            return timeDelta;
          }
          return getResourceIdentifier(b).localeCompare(getResourceIdentifier(a));
        });
        break;
    }

    return result;
  }, [freeResources, searchQuery, subjectFilter, typeFilter, sortBy, resolveDownloadCount]);

  const trustedResourcesForDisplay = useMemo(
    () =>
      trustedResources
        .map((resource) => ({
          ...resource,
          title: resource.title?.trim() || 'Trusted Resource',
          description: resource.description?.trim() || 'High-quality learning reference.',
          source: resource.source?.trim() || 'Trusted Source',
          type: resource.type?.trim() || 'Documentation',
          url: normalizeTrustedFinderUrl(resource.url || ''),
        }))
        .filter((resource) => Boolean(resource.title && resource.description)),
    [trustedResources]
  );

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
  const handleOpenResource = useCallback((resource: Resource): boolean => {
    if (!resource.url || resource.url === '#') {
      alert('Resource link is not available yet.');
      return false;
    }
    const resolvedUrl = resolveResourceViewUrl(resource.url);
    if (!resolvedUrl) {
      alert('Resource link is not available yet.');
      return false;
    }
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    return true;
  }, []);

  const updateDownloadCount = useCallback(async (resource: Resource) => {
    const resourceKey = getResourceIdentifier(resource);
    if (!resourceKey) {
      return;
    }

    const previousCount = resolveDownloadCount(resource);
    setDownloadOverrides((prev) => ({
      ...prev,
      [resourceKey]: previousCount + 1,
    }));

    try {
      const updated = await apiService.incrementResourceDownload(resourceKey);
      const updatedKey = getResourceIdentifier(updated) || resourceKey;
      const nextCount = Number(updated.downloadCount);
      setDownloadOverrides((prev) => ({
        ...prev,
        [updatedKey]: Number.isFinite(nextCount) ? Math.max(0, nextCount) : previousCount + 1,
      }));
    } catch (error) {
      console.error('Failed to update download count:', error);
      setDownloadOverrides((prev) => ({
        ...prev,
        [resourceKey]: previousCount,
      }));
    }
  }, [resolveDownloadCount]);

  const handleDownloadResource = useCallback((resource: Resource) => {
    const didOpen = handleOpenResource(resource);
    if (!didOpen) {
      return;
    }

    void updateDownloadCount(resource);
  }, [handleOpenResource, updateDownloadCount]);

  const handleFindTrustedResources = useCallback(async () => {
    const trimmedTopic = trustedTopicInput.trim();
    setTrustedFinderHasSearched(true);
    setTrustedFinderError(null);

    if (!trimmedTopic) {
      setTrustedResources([]);
      setTrustedTopicResult('');
      setTrustedFinderError('Please enter a subject or topic to find trusted resources.');
      return;
    }

    setTrustedFinderLoading(true);

    try {
      const response = await apiService.generateTrustedResources(trimmedTopic);
      const resourcesFromAi = Array.isArray(response.resources) ? response.resources : [];

      setTrustedTopicResult(response.topic || trimmedTopic);
      setTrustedResources(resourcesFromAi);

      if (resourcesFromAi.length === 0) {
        setTrustedFinderError(null);
      }
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to generate trusted resources right now. Please try again.';
      setTrustedResources([]);
      setTrustedTopicResult(trimmedTopic);
      setTrustedFinderError(message);
    } finally {
      setTrustedFinderLoading(false);
    }
  }, [trustedTopicInput]);

  const resetPage = () => setCurrentPage(1);

  const hasActiveFilters = searchQuery !== '' || subjectFilter !== 'All' || typeFilter !== 'All';

  return (
    <div className="page-container space-y-10">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
          <Library className="h-3 w-3" />
          <span>Resources Hub</span>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Student Learning Resources
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          Explore tutor-uploaded free materials and discover trusted external learning references curated by AI.
        </p>
      </header>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
            <BookMarked className="h-3 w-3" />
            <span>Section 1</span>
          </div>
          <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[1.75rem]">
            Free Resource Library
          </h3>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
            Browse tutor-uploaded papers, notes, and articles with filters, search, previews, and downloads.
          </p>
        </div>

        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search resources by title or description..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); resetPage(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col flex-wrap items-start gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {['All', ...stemSubjects].map((s) => (
              <button
                key={s}
                onClick={() => { setSubjectFilter(s); resetPage(); }}
                className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-all ${
                  subjectFilter === s
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                {s === 'All' ? 'All Subjects' : s}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none hover:border-slate-300"
            >
              <option value="All">All Types</option>
              <option value="Paper">Papers</option>
              <option value="Article">Articles</option>
              <option value="Note">Notes</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as SortOption); resetPage(); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none hover:border-slate-300"
            >
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="title">A–Z</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">
            {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} found
          </span>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(''); setSubjectFilter('All'); setTypeFilter('All'); resetPage(); }}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              <X className="h-3 w-3" /> Clear all filters
            </button>
          )}
        </div>

        {isLoading ? (
          <SkeletonGrid count={8} variant="resource-card" />
        ) : filteredResources.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No resources found"
            description={
              hasActiveFilters
                ? "We couldn't find any resources matching your filters. Try adjusting your search."
                : 'No free resources are available yet. Check back later!'
            }
            actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
            onAction={hasActiveFilters ? () => { setSearchQuery(''); setSubjectFilter('All'); setTypeFilter('All'); resetPage(); } : undefined}
          />
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {paginatedResources.map((resource, index) => {
                const resourceKey = getResourceIdentifier(resource) || `resource-${index}`;
                return (
                  <ResourceCard
                    key={resourceKey}
                    resource={resource}
                    downloadCount={resolveDownloadCount(resource)}
                    isWishlisted={wishlist.has(resourceKey)}
                    onToggleWishlist={() => toggleWishlist(resourceKey)}
                    onPreview={() => handleOpenResource(resource)}
                    onDownload={() => handleDownloadResource(resource)}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredResources.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </section>

      <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40 p-5 shadow-sm sm:p-7">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                <BookMarked className="h-3 w-3" />
                <span>Section 2</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                <Sparkles className="h-3 w-3" />
                <span>AI Finder</span>
              </div>
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[1.75rem]">
              Trusted Resources Finder AI
            </h3>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              Enter any subject or topic and get trusted learning resources curated by AI.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Subject / Category / Sub Topic / Path
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={trustedTopicInput}
                    onChange={(event) => setTrustedTopicInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !trustedFinderLoading) {
                        event.preventDefault();
                        void handleFindTrustedResources();
                      }
                    }}
                    placeholder="e.g. DevOps, Java OOP, Cloud Computing, Physics Mechanics, Kubernetes"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </label>

              <button
                onClick={() => void handleFindTrustedResources()}
                disabled={trustedFinderLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {trustedFinderLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {trustedFinderLoading ? 'Finding...' : 'Find Resources'}
              </button>
            </div>
          </div>

          {trustedFinderError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {trustedFinderError}
            </div>
          )}

          {!trustedFinderError && trustedFinderHasSearched && !trustedFinderLoading && trustedResourcesForDisplay.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-600">
              No trusted resources were returned for this topic. Try a more specific query.
            </div>
          )}

          {trustedFinderLoading && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI is curating trusted resources for your topic...
              </span>
            </div>
          )}

          {!trustedFinderLoading && trustedResourcesForDisplay.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col justify-between gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">Trusted Resources</h4>
                  <p className="text-xs font-medium text-slate-500">
                    Curated resources for {trustedTopicResult || trustedTopicInput.trim()}.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700">
                  {trustedResourcesForDisplay.length} recommendation{trustedResourcesForDisplay.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-3">
                {trustedResourcesForDisplay.map((resource, index) => {
                  const visual = getTrustedResourceVisual(resource);
                  const VisualIcon = visual.Icon;
                  const resourceKey = `${resource.url}-${index}`;

                  return (
                    <motion.article
                      key={resourceKey}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 sm:w-48 sm:flex-shrink-0 ${visual.bgClass} ${visual.borderClass}`}>
                          <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white ${visual.borderClass}`}>
                            <VisualIcon className={`h-4 w-4 ${visual.iconClass}`} />
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${visual.badgeClass}`}>
                            {visual.badge}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h5 className="truncate text-sm font-extrabold text-slate-900 sm:text-[15px]">{resource.title}</h5>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{resource.description}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                              {resource.source}
                            </span>
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                              {resource.type}
                            </span>
                          </div>
                        </div>

                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 sm:self-stretch"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
