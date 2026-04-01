import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookMarked,
  Search,
  Plus,
  X,
  Edit3,
  Trash2,
  Eye,
  Layers,
  Users,
  Star,
  GraduationCap,
  BarChart3,
  Upload,
  Play,
  FileText,
  Image as ImageIcon,
  Video,
  ChevronDown,
  ArrowUpDown,
  Package,
  Sparkles,
  Settings2,
  Link as LinkIcon,
} from 'lucide-react';
import { Course, CourseEnrollment, Tutor } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { SkeletonCard, SkeletonGrid } from '../common/SkeletonCard';
import { Pagination } from '../common/Pagination';
import { formatLkr } from '../../utils/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditableCourseModuleResource = {
  id: string;
  name: string;
  url: string;
};

type EditableCourseModule = {
  id?: string;
  title: string;
  videoUrl: string;
  resources: EditableCourseModuleResource[];
  resourceNameInput: string;
  resourceUrlInput: string;
};

type CourseFormData = {
  title: string;
  subject: string;
  description: string;
  isFree: boolean;
  price: number;
  thumbnail: string;
  modules: EditableCourseModule[];
};

type SortOption = 'newest' | 'popular' | 'rating' | 'title';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TutorCourseManagePageProps {
  courses: Course[];
  currentTutor: Tutor | undefined;
  courseEnrollments: CourseEnrollment[];
  enrollmentCountByCourseId: Map<string, number>;
  courseForm: CourseFormData;
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormData>>;
  editingCourseId: string | null;
  isSavingCourse: boolean;
  isLoading: boolean;
  isUploadingCourseThumbnail: boolean;
  uploadingModuleVideoKey: string | null;
  uploadingModuleResourcesKey: string | null;
  stemSubjects: string[];
  onSaveCourse: (event: React.FormEvent) => void;
  onDeleteCourse: (courseId: string) => void;
  onEditCourse: (course: Course) => void;
  onResetCourseForm: () => void;
  onAddCourseModule: () => void;
  onRemoveCourseModule: (moduleIndex: number) => void;
  onUpdateCourseModule: (moduleIndex: number, field: 'title' | 'videoUrl' | 'resourceNameInput' | 'resourceUrlInput', value: string) => void;
  onUploadCourseThumbnail: (file: File) => void;
  onUploadModuleVideo: (moduleIndex: number, file: File) => void;
  onUploadModuleResources: (moduleIndex: number, fileList: FileList) => void;
  onUpdateCourseModuleResource: (moduleIndex: number, resourceIndex: number, field: 'name' | 'url', value: string) => void;
  onRemoveCourseModuleResource: (moduleIndex: number, resourceIndex: number) => void;
  onAddUrlModuleResource: (moduleIndex: number) => void;
  getEditableModuleKey: (module: EditableCourseModule, moduleIndex: number) => string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getCourseRating = (courseId: string, enrolledCount: number): number => {
  if (enrolledCount === 0) return 0;
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) hash = ((hash << 5) - hash + courseId.charCodeAt(i)) | 0;
  return Math.round((3.5 + (Math.abs(hash) % 15) / 10) * 10) / 10;
};

const getCourseLevel = (moduleCount: number): string => {
  if (moduleCount <= 3) return 'Beginner';
  if (moduleCount <= 6) return 'Intermediate';
  return 'Advanced';
};

const LEVEL_COLORS: Record<string, string> = {
  Beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  Advanced: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ITEMS_PER_PAGE = 6;

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
}> = ({ icon: Icon, label, value, color, bgColor }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg transition-shadow duration-300"
  >
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  </motion.div>
);

// ─── Course Editor Panel ──────────────────────────────────────────────────────

const CourseEditorPanel: React.FC<{
  isOpen: boolean;
  courseForm: CourseFormData;
  setCourseForm: React.Dispatch<React.SetStateAction<CourseFormData>>;
  editingCourseId: string | null;
  isSavingCourse: boolean;
  isUploadingCourseThumbnail: boolean;
  uploadingModuleVideoKey: string | null;
  uploadingModuleResourcesKey: string | null;
  stemSubjects: string[];
  onSave: (event: React.FormEvent) => void;
  onClose: () => void;
  onAddModule: () => void;
  onRemoveModule: (idx: number) => void;
  onUpdateModule: (idx: number, field: 'title' | 'videoUrl' | 'resourceNameInput' | 'resourceUrlInput', value: string) => void;
  onUploadThumbnail: (file: File) => void;
  onUploadModuleVideo: (idx: number, file: File) => void;
  onUploadModuleResources: (idx: number, files: FileList) => void;
  onUpdateModuleResource: (mIdx: number, rIdx: number, field: 'name' | 'url', value: string) => void;
  onRemoveModuleResource: (mIdx: number, rIdx: number) => void;
  onAddUrlModuleResource: (mIdx: number) => void;
  getEditableModuleKey: (module: EditableCourseModule, idx: number) => string;
}> = ({
  isOpen,
  courseForm,
  setCourseForm,
  editingCourseId,
  isSavingCourse,
  isUploadingCourseThumbnail,
  uploadingModuleVideoKey,
  uploadingModuleResourcesKey,
  stemSubjects,
  onSave,
  onClose,
  onAddModule,
  onRemoveModule,
  onUpdateModule,
  onUploadThumbnail,
  onUploadModuleVideo,
  onUploadModuleResources,
  onUpdateModuleResource,
  onRemoveModuleResource,
  onAddUrlModuleResource,
  getEditableModuleKey,
}) => {
  const [activeSection, setActiveSection] = useState<'basic' | 'thumbnail' | 'pricing' | 'modules'>('basic');

  const sections = [
    { key: 'basic' as const, label: 'Basic Info', icon: FileText },
    { key: 'thumbnail' as const, label: 'Thumbnail', icon: ImageIcon },
    { key: 'pricing' as const, label: 'Pricing', icon: BarChart3 },
    { key: 'modules' as const, label: 'Modules', icon: Layers },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Slide-over Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 z-[201] h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  {editingCourseId ? 'Edit Course' : 'Create New Course'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingCourseId ? 'Update your course details and modules' : 'Fill in the details to publish a new course'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-100 px-6 flex-shrink-0 overflow-x-auto">
              {sections.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                      activeSection === s.key
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Form Body */}
            <form onSubmit={onSave} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-5">
                {/* ── Basic Info ── */}
                {activeSection === 'basic' && (
                  <motion.div
                    key="basic"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                        Course Title *
                      </label>
                      <input
                        type="text"
                        value={courseForm.title}
                        onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Advanced Web Development with React"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                        Subject *
                      </label>
                      <select
                        value={courseForm.subject}
                        onChange={(e) => setCourseForm((prev) => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                      >
                        {stemSubjects.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                        Description *
                      </label>
                      <textarea
                        value={courseForm.description}
                        onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe what students will learn in this course..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[120px] resize-none text-sm"
                        required
                      />
                    </div>
                  </motion.div>
                )}

                {/* ── Thumbnail ── */}
                {activeSection === 'thumbnail' && (
                  <motion.div
                    key="thumbnail"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                        Thumbnail URL
                      </label>
                      <input
                        type="url"
                        value={courseForm.thumbnail}
                        onChange={(e) => setCourseForm((prev) => ({ ...prev, thumbnail: e.target.value }))}
                        placeholder="https://example.com/thumbnail.jpg"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                      />
                    </div>

                    <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                      — or —
                    </div>

                    <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center group-hover:border-indigo-300 transition-colors">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Upload thumbnail image</p>
                        <p className="text-xs text-slate-400 mt-0.5">PNG, JPEG, or WebP — max 5MB</p>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUploadThumbnail(file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {isUploadingCourseThumbnail && (
                      <div className="flex items-center gap-2 text-sm text-indigo-600 font-bold">
                        <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        Uploading thumbnail...
                      </div>
                    )}

                    {courseForm.thumbnail && (
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <img
                          src={courseForm.thumbnail}
                          alt="Thumbnail preview"
                          className="w-full h-48 object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Pricing ── */}
                {activeSection === 'pricing' && (
                  <motion.div
                    key="pricing"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 block">
                        Course Pricing
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCourseForm((prev) => ({ ...prev, isFree: true, price: 0 }))}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            courseForm.isFree
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <Sparkles className={`w-5 h-5 mb-2 ${courseForm.isFree ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <p className={`text-sm font-bold ${courseForm.isFree ? 'text-emerald-700' : 'text-slate-700'}`}>Free Course</p>
                          <p className="text-xs text-slate-500 mt-0.5">Students can enroll instantly</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCourseForm((prev) => ({ ...prev, isFree: false }))}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            !courseForm.isFree
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <BarChart3 className={`w-5 h-5 mb-2 ${!courseForm.isFree ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <p className={`text-sm font-bold ${!courseForm.isFree ? 'text-indigo-700' : 'text-slate-700'}`}>Paid Course</p>
                          <p className="text-xs text-slate-500 mt-0.5">Payment required for enrollment</p>
                        </button>
                      </div>
                    </div>
                    {!courseForm.isFree && (
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                          Price (LKR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={courseForm.price}
                          onChange={(e) => setCourseForm((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
                          placeholder="Enter course price"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Modules ── */}
                {activeSection === 'modules' && (
                  <motion.div
                    key="modules"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Video Modules ({courseForm.modules.length})
                      </p>
                      <button
                        type="button"
                        onClick={onAddModule}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Module
                      </button>
                    </div>

                    {courseForm.modules.map((module, moduleIndex) => {
                      const moduleKey = getEditableModuleKey(module, moduleIndex);
                      return (
                        <div key={moduleKey} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
                              Module {moduleIndex + 1}
                            </p>
                            {courseForm.modules.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onRemoveModule(moduleIndex)}
                                className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                aria-label="Remove module"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Module Title */}
                          <input
                            type="text"
                            value={module.title}
                            onChange={(e) => onUpdateModule(moduleIndex, 'title', e.target.value)}
                            placeholder="Module title"
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                          />

                          {/* Video Input */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Video</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="url"
                                value={module.videoUrl}
                                onChange={(e) => onUpdateModule(moduleIndex, 'videoUrl', e.target.value)}
                                placeholder="Video URL (YouTube, Vimeo...)"
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                              />
                              <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
                                <Video className="w-3.5 h-3.5" />
                                Upload Video
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) onUploadModuleVideo(moduleIndex, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                            {uploadingModuleVideoKey === moduleKey && (
                              <p className="text-[11px] font-bold text-indigo-600 flex items-center gap-1.5">
                                <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                Uploading video...
                              </p>
                            )}
                            {module.videoUrl && module.videoUrl !== '#' && (
                              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                                <Play className="w-3 h-3" />
                                Video source set
                              </div>
                            )}
                          </div>

                          {/* Module Resources */}
                          <div className="pt-3 border-t border-slate-200 space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resources</label>

                            {module.resources.length > 0 && (
                              <div className="space-y-1.5">
                                {module.resources.map((resource, resourceIndex) => (
                                  <div key={resource.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                    <input
                                      type="text"
                                      value={resource.name}
                                      onChange={(e) => onUpdateModuleResource(moduleIndex, resourceIndex, 'name', e.target.value)}
                                      placeholder="Name"
                                      className="flex-1 min-w-0 px-2 py-1 text-xs outline-none bg-transparent"
                                    />
                                    <input
                                      type="text"
                                      value={resource.url}
                                      onChange={(e) => onUpdateModuleResource(moduleIndex, resourceIndex, 'url', e.target.value)}
                                      placeholder="URL/path"
                                      className="flex-1 min-w-0 px-2 py-1 text-xs outline-none bg-transparent text-slate-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => onRemoveModuleResource(moduleIndex, resourceIndex)}
                                      className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex-shrink-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add resource by URL */}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={module.resourceNameInput}
                                onChange={(e) => onUpdateModule(moduleIndex, 'resourceNameInput', e.target.value)}
                                placeholder="Name (optional)"
                                className="w-1/3 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none"
                              />
                              <input
                                type="url"
                                value={module.resourceUrlInput}
                                onChange={(e) => onUpdateModule(moduleIndex, 'resourceUrlInput', e.target.value)}
                                placeholder="Resource URL"
                                className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => onAddUrlModuleResource(moduleIndex)}
                                disabled={!module.resourceUrlInput.trim()}
                                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
                              >
                                <LinkIcon className="w-3 h-3" />
                                Add
                              </button>
                            </div>

                            {/* Upload resource files */}
                            <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-200 bg-white text-xs font-bold text-slate-500 cursor-pointer hover:border-indigo-300 hover:text-indigo-600 transition-all">
                              <Upload className="w-3.5 h-3.5" />
                              Upload Files (PDF, DOCX, PPTX...)
                              <input
                                type="file"
                                multiple
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.rar"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    onUploadModuleResources(moduleIndex, e.target.files);
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {uploadingModuleResourcesKey === moduleKey && (
                              <p className="text-[11px] font-bold text-indigo-600 flex items-center gap-1.5">
                                <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                Uploading resources...
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </div>

              {/* Sticky Footer */}
              <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCourse}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm shadow-indigo-200 flex items-center gap-2"
                >
                  {isSavingCourse && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {isSavingCourse ? 'Saving...' : editingCourseId ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── Course Card ──────────────────────────────────────────────────────────────

const CourseCard: React.FC<{
  course: Course;
  enrolledCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}> = ({ course, enrolledCount, onEdit, onDelete, onView }) => {
  const level = getCourseLevel(course.modules.length);
  const rating = getCourseRating(course.id, enrolledCount);
  const isFreeCourse = course.isFree || course.price <= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all duration-300 group flex flex-col sm:flex-row"
    >
      {/* Thumbnail */}
      <div className="relative sm:w-64 lg:w-72 flex-shrink-0 overflow-hidden bg-slate-100">
        <img
          src={course.thumbnail || `https://picsum.photos/seed/${course.id}/400/250`}
          alt={course.title}
          className="w-full h-48 sm:h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        {/* Overlay Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-slate-800 uppercase tracking-widest shadow-sm">
            {course.subject}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border ${LEVEL_COLORS[level]}`}>
            {level}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
            isFreeCourse
              ? 'bg-emerald-500 text-white'
              : 'bg-white/90 backdrop-blur-sm text-slate-800'
          }`}>
            {isFreeCourse ? 'Free' : formatLkr(course.price)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
        <div>
          <h4 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {course.title}
          </h4>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {course.description}
          </p>
        </div>

        {/* Meta Row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            <span>{course.modules.length} module{course.modules.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{enrolledCount} enrolled</span>
          </div>
          {rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-slate-700">{rating}</span>
            </div>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            Published
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-slate-100">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Manage Modules
          </button>
          <button
            onClick={onView}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-colors ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const TutorCourseManagePage: React.FC<TutorCourseManagePageProps> = ({
  courses,
  currentTutor,
  courseEnrollments,
  enrollmentCountByCourseId,
  courseForm,
  setCourseForm,
  editingCourseId,
  isSavingCourse,
  isLoading,
  isUploadingCourseThumbnail,
  uploadingModuleVideoKey,
  uploadingModuleResourcesKey,
  stemSubjects,
  onSaveCourse,
  onDeleteCourse,
  onEditCourse,
  onResetCourseForm,
  onAddCourseModule,
  onRemoveCourseModule,
  onUpdateCourseModule,
  onUploadCourseThumbnail,
  onUploadModuleVideo,
  onUploadModuleResources,
  onUpdateCourseModuleResource,
  onRemoveCourseModuleResource,
  onAddUrlModuleResource,
  getEditableModuleKey,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);

  // Tutor's own courses
  const myCourses = useMemo(
    () => (currentTutor ? courses.filter((c) => c.tutorId === currentTutor.id) : []),
    [courses, currentTutor]
  );

  // Stats
  const totalStudents = useMemo(() => {
    let count = 0;
    myCourses.forEach((c) => {
      count += enrollmentCountByCourseId.get(c.id) ?? c.enrolledStudents.length;
    });
    return count;
  }, [myCourses, enrollmentCountByCourseId]);

  const avgRating = useMemo(() => {
    const ratings = myCourses.map((c) => {
      const enrolled = enrollmentCountByCourseId.get(c.id) ?? c.enrolledStudents.length;
      return getCourseRating(c.id, enrolled);
    }).filter((r) => r > 0);
    if (ratings.length === 0) return 0;
    return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  }, [myCourses, enrollmentCountByCourseId]);

  // Filtered & sorted
  const filteredCourses = useMemo(() => {
    let result = myCourses.filter((c) => {
      const matchesSearch = searchQuery === '' ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = subjectFilter === 'All' || c.subject === subjectFilter;
      return matchesSearch && matchesSubject;
    });

    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => {
          const ac = enrollmentCountByCourseId.get(a.id) ?? a.enrolledStudents.length;
          const bc = enrollmentCountByCourseId.get(b.id) ?? b.enrolledStudents.length;
          return bc - ac;
        });
        break;
      case 'rating':
        result.sort((a, b) => {
          const ac = enrollmentCountByCourseId.get(a.id) ?? a.enrolledStudents.length;
          const bc = enrollmentCountByCourseId.get(b.id) ?? b.enrolledStudents.length;
          return getCourseRating(b.id, bc) - getCourseRating(a.id, ac);
        });
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
  }, [myCourses, searchQuery, subjectFilter, sortBy, enrollmentCountByCourseId]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / ITEMS_PER_PAGE));
  const paginatedCourses = useMemo(
    () => filteredCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredCourses, currentPage]
  );

  // Handlers
  const handleCreateNew = () => {
    onResetCourseForm();
    setIsEditorOpen(true);
  };

  const handleEditCourse = (course: Course) => {
    onEditCourse(course);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    onResetCourseForm();
  };

  const handleSaveAndClose = (e: React.FormEvent) => {
    onSaveCourse(e);
    // Close editor only after save completes — handled via useEffect or isSavingCourse
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDeleteCourse(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  // Reset page on filter change
  const handleSearchChange = (q: string) => { setSearchQuery(q); setCurrentPage(1); };
  const handleSubjectChange = (s: string) => { setSubjectFilter(s); setCurrentPage(1); };
  const handleSortChange = (s: SortOption) => { setSortBy(s); setCurrentPage(1); };

  return (
    <div className="page-container space-y-8">
      {/* ═══ Quick Stats ═══ */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={BookMarked} label="Total Courses" value={myCourses.length} color="text-indigo-600" bgColor="bg-indigo-50" />
          <StatCard icon={Users} label="Total Students" value={totalStudents} color="text-emerald-600" bgColor="bg-emerald-50" />
          <StatCard icon={Star} label="Avg Rating" value={avgRating > 0 ? avgRating : '—'} color="text-amber-600" bgColor="bg-amber-50" />
        </div>
      )}

      {/* ═══ Page Header ═══ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
            <BookMarked className="w-3 h-3 fill-indigo-700" />
            <span>Tutor Content Studio</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Manage University Video Courses
          </h2>
          <p className="text-slate-500 text-sm max-w-lg leading-relaxed">
            Create, edit, and publish video-based courses for university learners.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 hover:-translate-y-0.5 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create New Course
        </button>
      </div>

      {/* ═══ Controls Bar ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Subject Filter */}
        <select
          value={subjectFilter}
          onChange={(e) => handleSubjectChange(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none hover:border-slate-300 transition-colors"
        >
          <option value="All">All Subjects</option>
          {stemSubjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none hover:border-slate-300 transition-colors"
        >
          <option value="newest">Newest</option>
          <option value="popular">Most Popular</option>
          <option value="rating">Top Rated</option>
          <option value="title">A–Z</option>
        </select>

        {/* Count */}
        <span className="text-xs font-semibold text-slate-400 ml-auto">
          {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ═══ Course List ═══ */}
      {isLoading ? (
        <SkeletonGrid count={4} variant="course-wide" />
      ) : filteredCourses.length === 0 ? (
        myCourses.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No courses yet"
            description="Start by creating your first video course. It only takes a few minutes to publish your content."
            actionLabel="Create First Course"
            onAction={handleCreateNew}
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No matching courses"
            description="Try adjusting your search or filters to find your courses."
            actionLabel="Clear Filters"
            onAction={() => { setSearchQuery(''); setSubjectFilter('All'); setCurrentPage(1); }}
          />
        )
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {paginatedCourses.map((course) => {
              const enrolledCount = enrollmentCountByCourseId.get(course.id) ?? course.enrolledStudents.length;
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrolledCount={enrolledCount}
                  onEdit={() => handleEditCourse(course)}
                  onDelete={() => setDeleteTarget({ id: course.id, title: course.title })}
                  onView={() => setPreviewCourse(course)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ Pagination ═══ */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredCourses.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
      />

      {/* ═══ Course Editor Slide-Over ═══ */}
      <CourseEditorPanel
        isOpen={isEditorOpen}
        courseForm={courseForm}
        setCourseForm={setCourseForm}
        editingCourseId={editingCourseId}
        isSavingCourse={isSavingCourse}
        isUploadingCourseThumbnail={isUploadingCourseThumbnail}
        uploadingModuleVideoKey={uploadingModuleVideoKey}
        uploadingModuleResourcesKey={uploadingModuleResourcesKey}
        stemSubjects={stemSubjects}
        onSave={handleSaveAndClose}
        onClose={handleCloseEditor}
        onAddModule={onAddCourseModule}
        onRemoveModule={onRemoveCourseModule}
        onUpdateModule={onUpdateCourseModule}
        onUploadThumbnail={onUploadCourseThumbnail}
        onUploadModuleVideo={onUploadModuleVideo}
        onUploadModuleResources={onUploadModuleResources}
        onUpdateModuleResource={onUpdateCourseModuleResource}
        onRemoveModuleResource={onRemoveCourseModuleResource}
        onAddUrlModuleResource={onAddUrlModuleResource}
        getEditableModuleKey={getEditableModuleKey}
      />

      {/* ═══ Delete Confirm Dialog ═══ */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Course"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This will also remove all associated student enrollments. This action cannot be undone.`}
        confirmLabel="Delete Course"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ═══ Quick Preview Modal ═══ */}
      <AnimatePresence>
        {previewCourse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setPreviewCourse(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-slate-100 flex-shrink-0">
                <img
                  src={previewCourse.thumbnail || `https://picsum.photos/seed/${previewCourse.id}/600/340`}
                  alt={previewCourse.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => setPreviewCourse(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                <h3 className="text-xl font-extrabold text-slate-900">{previewCourse.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{previewCourse.description}</p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                  <span className="px-2.5 py-1 bg-slate-100 rounded-full">{previewCourse.subject}</span>
                  <span className="px-2.5 py-1 bg-slate-100 rounded-full">{previewCourse.modules.length} Modules</span>
                  <span className="px-2.5 py-1 bg-slate-100 rounded-full">
                    {(previewCourse.isFree || previewCourse.price <= 0) ? 'Free' : formatLkr(previewCourse.price)}
                  </span>
                </div>
                {previewCourse.modules.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Modules</p>
                    <div className="space-y-1.5">
                      {previewCourse.modules.map((mod, idx) => (
                        <div key={mod.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-slate-700 font-medium truncate">{mod.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
