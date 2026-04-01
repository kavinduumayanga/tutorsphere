import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Plus,
  X,
  Edit3,
  Trash2,
  Eye,
  Download,
  Upload,
  FileText,
  FileImage,
  FileVideo,
  File,
  BookOpen,
  Package,
  CheckSquare,
  Square,
  Tag,
  ExternalLink,
  Folder,
} from 'lucide-react';
import { Resource } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { SkeletonGrid } from '../common/SkeletonCard';
import { Pagination } from '../common/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceFormData = {
  title: string;
  subject: string;
  type: Resource['type'];
  url: string;
  description: string;
};

type ResourceInputMode = 'url' | 'file';
type ResourceUploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

type SortOption = 'newest' | 'title' | 'type';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TutorResourceManagePageProps {
  resources: Resource[];
  currentTutorId: string | undefined;
  resourceForm: ResourceFormData;
  setResourceForm: React.Dispatch<React.SetStateAction<ResourceFormData>>;
  editingResourceId: string | null;
  isSavingResource: boolean;
  isUploadingResourceFile: boolean;
  resourceUploadStatus: ResourceUploadStatus;
  resourceUploadProgress: number;
  resourceUploadStatusMessage: string;
  onClearResourceUploadFeedback: () => void;
  resourceInputMode: ResourceInputMode;
  setResourceInputMode: React.Dispatch<React.SetStateAction<ResourceInputMode>>;
  resourceUploadFile: File | null;
  setResourceUploadFile: React.Dispatch<React.SetStateAction<File | null>>;
  isLoading: boolean;
  stemSubjects: string[];
  onSaveResource: (event: React.FormEvent) => void;
  onDeleteResource: (resourceId: string) => void;
  onEditResource: (resource: Resource) => void;
  onResetResourceForm: () => void;
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

const getFileTypeBadge = (type: Resource['type']): { bg: string; text: string } => {
  switch (type) {
    case 'Paper': return { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' };
    case 'Article': return { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' };
    case 'Note': return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' };
    default: return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' };
  }
};

const resolveResourcePreviewUrl = (rawUrl: string): string => {
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

// Simulated download count from resource id for display purposes
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

const ITEMS_PER_PAGE = 9;

// ─── Upload Modal ─────────────────────────────────────────────────────────────

const UploadModal: React.FC<{
  isOpen: boolean;
  form: ResourceFormData;
  setForm: React.Dispatch<React.SetStateAction<ResourceFormData>>;
  editingId: string | null;
  isSaving: boolean;
  isUploadingFile: boolean;
  uploadStatus: ResourceUploadStatus;
  uploadProgress: number;
  uploadStatusMessage: string;
  onClearUploadFeedback: () => void;
  inputMode: ResourceInputMode;
  setInputMode: React.Dispatch<React.SetStateAction<ResourceInputMode>>;
  selectedFile: File | null;
  setSelectedFile: React.Dispatch<React.SetStateAction<File | null>>;
  stemSubjects: string[];
  onSave: (event: React.FormEvent) => void;
  onClose: () => void;
}> = ({
  isOpen,
  form,
  setForm,
  editingId,
  isSaving,
  isUploadingFile,
  uploadStatus,
  uploadProgress,
  uploadStatusMessage,
  onClearUploadFeedback,
  inputMode,
  setInputMode,
  selectedFile,
  setSelectedFile,
  stemSubjects,
  onSave,
  onClose,
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed inset-0 z-[201] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingId ? 'Edit Resource' : 'Upload Resource'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingId ? 'Update the resource details' : 'Share a learning resource with your students'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={onSave} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Resource title"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Subject</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none text-sm"
                  >
                    {stemSubjects.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Resource['type'] }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none text-sm"
                  >
                    <option value="Paper">Paper</option>
                    <option value="Article">Article</option>
                    <option value="Note">Note</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Resource Source *</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClearUploadFeedback();
                      setInputMode('url');
                      setSelectedFile(null);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                      inputMode === 'url'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Use URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearUploadFeedback();
                      setInputMode('file');
                      setSelectedFile(null);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                      inputMode === 'file'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {inputMode === 'url' ? (
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Resource URL *</label>
                  <input
                    type="url"
                    value={form.url}
                    onChange={(e) => {
                      onClearUploadFeedback();
                      setForm((p) => ({ ...p, url: e.target.value }));
                    }}
                    placeholder="https://example.com/resource.pdf"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    required={inputMode === 'url'}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Upload Resource File *</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.rar"
                    onChange={(e) => {
                      onClearUploadFeedback();
                      const file = e.target.files?.[0] || null;
                      setSelectedFile(file);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none text-sm"
                  />
                  <p className="text-[11px] text-slate-500">
                    Supported files: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, ZIP, RAR (max 50MB).
                  </p>
                  {selectedFile && (
                    <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
                      <p className="text-xs text-indigo-700 font-semibold truncate pr-3">Selected: {selectedFile.name}</p>
                      <button
                        type="button"
                        onClick={() => {
                          onClearUploadFeedback();
                          setSelectedFile(null);
                        }}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  {!selectedFile && editingId && form.url.startsWith('/uploads/') && (
                    <p className="text-[11px] text-slate-500 break-all">
                      Current file path: {form.url}
                    </p>
                  )}
                </div>
              )}

              {uploadStatus !== 'idle' && (
                <div
                  className={`rounded-xl border px-4 py-3 ${
                    uploadStatus === 'error'
                      ? 'bg-rose-50 border-rose-200'
                      : uploadStatus === 'uploaded'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-indigo-50 border-indigo-200'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold ${
                      uploadStatus === 'error'
                        ? 'text-rose-700'
                        : uploadStatus === 'uploaded'
                          ? 'text-emerald-700'
                          : 'text-indigo-700'
                    }`}
                  >
                    {uploadStatusMessage ||
                      (uploadStatus === 'uploading'
                        ? 'Uploading resource file...'
                        : uploadStatus === 'uploaded'
                          ? 'Upload completed successfully.'
                          : 'Upload failed.')}
                  </p>
                  {uploadStatus === 'uploading' && (
                    <>
                      <div className="mt-2 h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-300"
                          style={{ width: `${Math.max(6, Math.min(100, uploadProgress))}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-indigo-600">{uploadProgress}%</p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of the resource..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] resize-none text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm shadow-indigo-200 flex items-center gap-2"
                >
                  {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isSaving ? (isUploadingFile ? 'Uploading file...' : 'Saving...') : editingId ? 'Update' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ─── Resource Card ────────────────────────────────────────────────────────────

const ResourceCard: React.FC<{
  resource: Resource;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}> = ({ resource, isSelected, onToggleSelect, onEdit, onDelete, onPreview }) => {
  const TypeIcon = getFileTypeIcon(resource.type);
  const badge = getFileTypeBadge(resource.type);
  const downloadCount = getSimulatedDownloadCount(resource.id);
  const fileSize = getSimulatedFileSize(resource.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-all duration-300 group ${
        isSelected ? 'border-indigo-300 ring-2 ring-indigo-500/20' : 'border-slate-100'
      }`}
    >
      <div className="p-5 space-y-3">
        {/* Top Row */}
        <div className="flex items-start gap-3">
          {/* Select Checkbox */}
          <button
            onClick={onToggleSelect}
            className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-indigo-500 transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-indigo-500" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>

          {/* Icon */}
          <div className={`w-11 h-11 rounded-xl ${badge.bg} border flex items-center justify-center flex-shrink-0`}>
            <TypeIcon className={`w-5 h-5 ${badge.text}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-extrabold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
              {resource.title}
            </h4>
            {resource.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                {resource.description}
              </p>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap pl-8">
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border ${badge.bg} ${badge.text}`}>
            {resource.type}
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {resource.subject}
          </span>
          <span className="text-[10px] text-slate-400">•</span>
          <span className="text-[10px] text-slate-400 font-medium">{fileSize}</span>
          <span className="text-[10px] text-slate-400">•</span>
          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
            <Download className="w-2.5 h-2.5" /> {downloadCount}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-50 pl-8">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={onPreview}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-colors ml-auto"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const TutorResourceManagePage: React.FC<TutorResourceManagePageProps> = ({
  resources,
  currentTutorId,
  resourceForm,
  setResourceForm,
  editingResourceId,
  isSavingResource,
  isUploadingResourceFile,
  resourceUploadStatus,
  resourceUploadProgress,
  resourceUploadStatusMessage,
  onClearResourceUploadFeedback,
  resourceInputMode,
  setResourceInputMode,
  resourceUploadFile,
  setResourceUploadFile,
  isLoading,
  stemSubjects,
  onSaveResource,
  onDeleteResource,
  onEditResource,
  onResetResourceForm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Tutor's own resources
  const myResources = useMemo(
    () => (currentTutorId ? resources.filter((r) => r.tutorId === currentTutorId) : []),
    [resources, currentTutorId]
  );

  // Filtered & sorted
  const filteredResources = useMemo(() => {
    let result = myResources.filter((r) => {
      const matchesSearch = searchQuery === '' ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = subjectFilter === 'All' || r.subject === subjectFilter;
      const matchesType = typeFilter === 'All' || r.type === typeFilter;
      return matchesSearch && matchesSubject && matchesType;
    });

    switch (sortBy) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'type':
        result.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case 'newest':
      default:
        result.sort((a, b) => b.id.localeCompare(a.id));
        break;
    }

    return result;
  }, [myResources, searchQuery, subjectFilter, typeFilter, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredResources.length / ITEMS_PER_PAGE));
  const paginatedResources = useMemo(
    () => filteredResources.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredResources, currentPage]
  );

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => {
    if (selectedIds.size === paginatedResources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedResources.map((r) => r.id)));
    }
  };

  // Handlers
  const handleOpenUpload = () => {
    onResetResourceForm();
    setIsUploadModalOpen(true);
  };

  const handleEdit = (resource: Resource) => {
    onEditResource(resource);
    setIsUploadModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsUploadModalOpen(false);
    onResetResourceForm();
  };

  const handleSave = (e: React.FormEvent) => {
    onSaveResource(e);
    // Modal close handled by isSavingResource state change
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDeleteResource(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next; });
    }
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => onDeleteResource(id));
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const handlePreview = (resource: Resource) => {
    if (!resource.url || resource.url === '#') {
      alert('Resource link is not available yet.');
      return;
    }
    const resolvedUrl = resolveResourcePreviewUrl(resource.url);
    if (!resolvedUrl) {
      alert('Resource link is not available yet.');
      return;
    }
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  };

  // Reset page on filter change
  const resetPage = () => setCurrentPage(1);

  return (
    <div className="page-container space-y-8">
      {/* ═══ Page Header ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-[10px] font-black uppercase tracking-widest">
            <Folder className="w-3 h-3" />
            <span>Resource Manager</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Manage Free Learning Resources
          </h2>
          <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
            Upload and organize free papers, articles, and notes for your university students.
          </p>
        </div>
        <button
          onClick={handleOpenUpload}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 hover:-translate-y-0.5 flex-shrink-0"
        >
          <Upload className="w-4 h-4" />
          Upload Resource
        </button>
      </div>

      {/* ═══ Controls Bar ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Subject */}
        <select
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); resetPage(); }}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none hover:border-slate-300"
        >
          <option value="All">All Subjects</option>
          {stemSubjects.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none hover:border-slate-300"
        >
          <option value="All">All Types</option>
          <option value="Paper">Paper</option>
          <option value="Article">Article</option>
          <option value="Note">Note</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value as SortOption); resetPage(); }}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none hover:border-slate-300"
        >
          <option value="newest">Newest</option>
          <option value="title">A–Z</option>
          <option value="type">By Type</option>
        </select>

        <span className="text-xs font-semibold text-slate-400 ml-auto">
          {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ═══ Bulk Actions Bar ═══ */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              {selectedIds.size === paginatedResources.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs font-bold text-indigo-700">
              {selectedIds.size} selected
            </span>
          </div>
          <button
            onClick={() => setBulkDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Selected
          </button>
        </motion.div>
      )}

      {/* ═══ Resources Grid ═══ */}
      {isLoading ? (
        <SkeletonGrid count={6} variant="resource-card" />
      ) : filteredResources.length === 0 ? (
        myResources.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No resources uploaded"
            description="Share your first paper, article, or note with your students."
            actionLabel="Upload First Resource"
            onAction={handleOpenUpload}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No matching resources"
            description="Try adjusting your search or filters."
            actionLabel="Clear Filters"
            onAction={() => { setSearchQuery(''); setSubjectFilter('All'); setTypeFilter('All'); resetPage(); }}
          />
        )
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {paginatedResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                isSelected={selectedIds.has(resource.id)}
                onToggleSelect={() => toggleSelect(resource.id)}
                onEdit={() => handleEdit(resource)}
                onDelete={() => setDeleteTarget({ id: resource.id, title: resource.title })}
                onPreview={() => handlePreview(resource)}
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

      {/* ═══ Upload/Edit Modal ═══ */}
      <UploadModal
        isOpen={isUploadModalOpen}
        form={resourceForm}
        setForm={setResourceForm}
        editingId={editingResourceId}
        isSaving={isSavingResource}
        isUploadingFile={isUploadingResourceFile}
        uploadStatus={resourceUploadStatus}
        uploadProgress={resourceUploadProgress}
        uploadStatusMessage={resourceUploadStatusMessage}
        onClearUploadFeedback={onClearResourceUploadFeedback}
        inputMode={resourceInputMode}
        setInputMode={setResourceInputMode}
        selectedFile={resourceUploadFile}
        setSelectedFile={setResourceUploadFile}
        stemSubjects={stemSubjects}
        onSave={handleSave}
        onClose={handleCloseModal}
      />

      {/* ═══ Delete Confirm Dialog ═══ */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Resource"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ═══ Bulk Delete Confirm ═══ */}
      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        title="Delete Selected Resources"
        message={`Are you sure you want to delete ${selectedIds.size} selected resource${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Resource${selectedIds.size !== 1 ? 's' : ''}`}
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
};
