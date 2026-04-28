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
  TicketPercent,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Hash,
  Percent,
} from 'lucide-react';
import { Course, CourseCoupon, CourseEnrollment, Tutor } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';
import { SkeletonCard, SkeletonGrid } from '../common/SkeletonCard';
import { Pagination } from '../common/Pagination';
import { formatLkr } from '../../utils/currency';
import { DEFAULT_COURSE_THUMBNAIL_PLACEHOLDER } from '../../utils/defaultImages';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditableCourseModuleResource = {
  id: string;
  name: string;
  url: string;
  blobName?: string;
  mimeType?: string;
  size?: number;
};

type EditableCourseModule = {
  id?: string;
  title: string;
  videoUrl: string;
  videoBlobName?: string;
  videoMimeType?: string;
  videoSize?: number;
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
  thumbnailBlobName: string | undefined;
  thumbnailMimeType: string | undefined;
  thumbnailSize: number | undefined;
  modules: EditableCourseModule[];
};

type SortOption = 'newest' | 'popular' | 'rating' | 'title';
type UploadProgressStatus = 'idle' | 'preparing' | 'uploading' | 'processing' | 'uploaded' | 'failed';

type UploadProgressState = {
  status: UploadProgressStatus;
  progress: number;
  message: string;
  speedBytesPerSecond?: number;
  uploadedBytes?: number;
  totalBytes?: number;
};

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
  courseThumbnailUploadState: UploadProgressState;
  uploadingModuleVideoKey: string | null;
  moduleVideoUploadStateByKey: Record<string, UploadProgressState>;
  uploadingModuleResourcesKey: string | null;
  stemSubjects: string[];
  onSaveCourse: (event: React.FormEvent) => Promise<boolean>;
  onDeleteCourse: (courseId: string) => Promise<boolean>;
  onEditCourse: (course: Course) => void;
  onResetCourseForm: () => void;
  onAddCourseModule: () => void;
  onRemoveCourseModule: (moduleIndex: number) => void;
  onUpdateCourseModule: (moduleIndex: number, field: 'title' | 'videoUrl' | 'resourceNameInput' | 'resourceUrlInput', value: string) => void;
  onUploadCourseThumbnail: (file: File) => void;
  onResetCourseThumbnailUploadState: () => void;
  onUploadModuleVideo: (moduleIndex: number, file: File) => void;
  onUploadModuleResources: (moduleIndex: number, fileList: FileList) => void;
  onUpdateCourseModuleResource: (moduleIndex: number, resourceIndex: number, field: 'name' | 'url', value: string) => void;
  onRemoveCourseModuleResource: (moduleIndex: number, resourceIndex: number) => void;
  onAddUrlModuleResource: (moduleIndex: number) => void;
  getEditableModuleKey: (module: EditableCourseModule, moduleIndex: number) => string;
  onGetCourseCoupons: (courseId: string) => Promise<CourseCoupon[]>;
  onCreateCourseCoupon: (
    courseId: string,
    payload: {
      code: string;
      discountPercentage: number;
      isActive?: boolean;
      expiresAt?: string;
      usageLimit?: number;
    }
  ) => Promise<CourseCoupon>;
  onUpdateCourseCoupon: (
    courseId: string,
    couponId: string,
    payload: {
      code?: string;
      discountPercentage?: number;
      isActive?: boolean;
      expiresAt?: string | null;
      usageLimit?: number | null;
    }
  ) => Promise<CourseCoupon>;
  onToggleCourseCouponStatus: (
    courseId: string,
    couponId: string,
    isActive: boolean
  ) => Promise<CourseCoupon>;
  onDeleteCourseCoupon: (courseId: string, couponId: string) => Promise<void>;
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

const getEntityTimestamp = (item: { id: string }): number => {
  const createdAt = Date.parse(String((item as any).createdAt || ''));
  if (!Number.isNaN(createdAt)) {
    return createdAt;
  }

  const updatedAt = Date.parse(String((item as any).updatedAt || ''));
  if (!Number.isNaN(updatedAt)) {
    return updatedAt;
  }

  return 0;
};

const LEVEL_COLORS: Record<string, string> = {
  Beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  Advanced: 'bg-rose-50 text-rose-700 border-rose-200',
};

const ITEMS_PER_PAGE = 6;

type CouponFormData = {
  code: string;
  discountPercentage: string;
  expiresAt: string;
  usageLimit: string;
  isActive: boolean;
};

const INITIAL_COUPON_FORM: CouponFormData = {
  code: '',
  discountPercentage: '',
  expiresAt: '',
  usageLimit: '',
  isActive: true,
};

const toDateTimeLocalInput = (value?: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const formatDateTimeLabel = (value?: string): string => {
  if (!value) {
    return 'No expiry';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString();
};

const formatUploadSpeed = (speedBytesPerSecond?: number): string => {
  const speed = Number(speedBytesPerSecond);
  if (!Number.isFinite(speed) || speed <= 0) {
    return '';
  }

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let value = speed;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const formatFileSize = (sizeBytes?: number): string => {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size < 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

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
  courseThumbnailUploadState: UploadProgressState;
  uploadingModuleVideoKey: string | null;
  moduleVideoUploadStateByKey: Record<string, UploadProgressState>;
  uploadingModuleResourcesKey: string | null;
  stemSubjects: string[];
  onSave: (event: React.FormEvent) => Promise<boolean>;
  onClose: () => void;
  onAddModule: () => void;
  onRemoveModule: (idx: number) => void;
  onUpdateModule: (idx: number, field: 'title' | 'videoUrl' | 'resourceNameInput' | 'resourceUrlInput', value: string) => void;
  onUploadThumbnail: (file: File) => void;
  onResetThumbnailUploadState: () => void;
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
  courseThumbnailUploadState,
  uploadingModuleVideoKey,
  moduleVideoUploadStateByKey,
  uploadingModuleResourcesKey,
  stemSubjects,
  onSave,
  onClose,
  onAddModule,
  onRemoveModule,
  onUpdateModule,
  onUploadThumbnail,
  onResetThumbnailUploadState,
  onUploadModuleVideo,
  onUploadModuleResources,
  onUpdateModuleResource,
  onRemoveModuleResource,
  onAddUrlModuleResource,
  getEditableModuleKey,
}) => {
  const [activeSection, setActiveSection] = useState<'basic' | 'thumbnail' | 'pricing' | 'modules'>('basic');
  const isAnyUploadInProgress =
    isUploadingCourseThumbnail ||
    Boolean(uploadingModuleVideoKey) ||
    Boolean(uploadingModuleResourcesKey) ||
    courseThumbnailUploadState.status === 'preparing' ||
    courseThumbnailUploadState.status === 'uploading' ||
    courseThumbnailUploadState.status === 'processing' ||
    Object.values(moduleVideoUploadStateByKey).some((state) =>
      state.status === 'preparing' || state.status === 'uploading' || state.status === 'processing'
    );

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
                        Thumbnail URL or Uploaded Path
                      </label>
                      <input
                        type="text"
                        value={courseForm.thumbnail}
                        onChange={(e) =>
                          setCourseForm((prev) => ({
                            ...prev,
                            thumbnail: e.target.value,
                            thumbnailBlobName: undefined,
                            thumbnailMimeType: undefined,
                            thumbnailSize: undefined,
                          }))
                        }
                        onInput={onResetThumbnailUploadState}
                        placeholder="https://example.com/thumbnail.jpg"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                      />
                    </div>

                    <div className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                      — or —
                    </div>

                    <label
                      className={`flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all group ${
                        isUploadingCourseThumbnail
                          ? 'cursor-not-allowed opacity-70'
                          : 'cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                    >
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
                        disabled={isUploadingCourseThumbnail}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUploadThumbnail(file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {(courseThumbnailUploadState.status !== 'idle' || isUploadingCourseThumbnail) && (
                      <div
                        className={`rounded-xl border px-4 py-3 ${
                          courseThumbnailUploadState.status === 'failed'
                            ? 'border-rose-200 bg-rose-50'
                            : courseThumbnailUploadState.status === 'uploaded'
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-indigo-200 bg-indigo-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-slate-700">
                            {courseThumbnailUploadState.status === 'failed' && 'Thumbnail upload failed'}
                            {courseThumbnailUploadState.status === 'uploaded' && 'Thumbnail uploaded'}
                            {courseThumbnailUploadState.status === 'preparing' && 'Preparing upload'}
                            {courseThumbnailUploadState.status === 'uploading' && 'Uploading thumbnail'}
                            {courseThumbnailUploadState.status === 'processing' && 'Saving to cloud storage'}
                          </p>
                          <div className="flex items-center gap-2">
                            {(courseThumbnailUploadState.status === 'preparing' ||
                              courseThumbnailUploadState.status === 'uploading' ||
                              courseThumbnailUploadState.status === 'processing') && (
                              <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                            )}
                            <span className="text-xs font-extrabold text-slate-600">
                              {Math.max(0, Math.min(100, Math.round(courseThumbnailUploadState.progress || 0)))}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/90 border border-slate-200 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              courseThumbnailUploadState.status === 'failed'
                                ? 'bg-rose-500'
                                : courseThumbnailUploadState.status === 'uploaded'
                                  ? 'bg-emerald-500'
                                  : 'bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, courseThumbnailUploadState.progress || 0))}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-600">
                          {courseThumbnailUploadState.message || (isUploadingCourseThumbnail ? 'Uploading thumbnail...' : '')}
                        </p>
                        {(courseThumbnailUploadState.status === 'uploading' || courseThumbnailUploadState.status === 'processing') && (
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            {`${formatFileSize(courseThumbnailUploadState.uploadedBytes)} / ${formatFileSize(courseThumbnailUploadState.totalBytes)}`}
                          </p>
                        )}
                        {(courseThumbnailUploadState.status === 'uploading' || courseThumbnailUploadState.status === 'processing') && (
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">
                            {formatUploadSpeed(courseThumbnailUploadState.speedBytesPerSecond) || 'Calculating upload speed...'}
                          </p>
                        )}
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
                      const moduleVideoUploadState = moduleVideoUploadStateByKey[moduleKey];
                      const normalizedVideoUploadProgress = Math.max(
                        0,
                        Math.min(100, Math.round(moduleVideoUploadState?.progress || 0))
                      );
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
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Video URL or Uploaded Path</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={module.videoUrl}
                                onChange={(e) => onUpdateModule(moduleIndex, 'videoUrl', e.target.value)}
                                placeholder="YouTube/Vimeo URL or uploaded video URL"
                                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                              />
                              <label
                                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 transition-all ${
                                  uploadingModuleVideoKey
                                    ? 'cursor-not-allowed opacity-70'
                                    : 'cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30'
                                }`}
                              >
                                <Video className="w-3.5 h-3.5" />
                                Upload Video
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  disabled={Boolean(uploadingModuleVideoKey)}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) onUploadModuleVideo(moduleIndex, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                            {(moduleVideoUploadState?.status && moduleVideoUploadState.status !== 'idle') || uploadingModuleVideoKey === moduleKey ? (
                              <div
                                className={`rounded-lg border px-3 py-2 ${
                                  moduleVideoUploadState?.status === 'failed'
                                    ? 'border-rose-200 bg-rose-50'
                                    : moduleVideoUploadState?.status === 'uploaded'
                                      ? 'border-emerald-200 bg-emerald-50'
                                      : 'border-indigo-200 bg-indigo-50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-slate-700">
                                    {moduleVideoUploadState?.status === 'failed' && 'Video upload failed'}
                                    {moduleVideoUploadState?.status === 'uploaded' && 'Video uploaded'}
                                    {moduleVideoUploadState?.status === 'preparing' && 'Preparing upload'}
                                    {moduleVideoUploadState?.status === 'uploading' && 'Uploading video'}
                                    {moduleVideoUploadState?.status === 'processing' && 'Saving to cloud storage'}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    {(moduleVideoUploadState?.status === 'preparing' ||
                                      moduleVideoUploadState?.status === 'uploading' ||
                                      moduleVideoUploadState?.status === 'processing') && (
                                      <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                    )}
                                    <span className="text-[11px] font-extrabold text-slate-600">{normalizedVideoUploadProgress}%</span>
                                  </div>
                                </div>
                                <div className="mt-1.5 h-1.5 rounded-full bg-white/90 border border-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      moduleVideoUploadState?.status === 'failed'
                                        ? 'bg-rose-500'
                                        : moduleVideoUploadState?.status === 'uploaded'
                                          ? 'bg-emerald-500'
                                          : 'bg-indigo-500'
                                    }`}
                                    style={{ width: `${normalizedVideoUploadProgress}%` }}
                                  />
                                </div>
                                <p className="mt-1 text-[10px] text-slate-600">
                                  {moduleVideoUploadState?.message || (uploadingModuleVideoKey === moduleKey ? 'Uploading video...' : '')}
                                </p>
                                {(moduleVideoUploadState?.status === 'uploading' || moduleVideoUploadState?.status === 'processing') && (
                                  <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                    {`${formatFileSize(moduleVideoUploadState?.uploadedBytes)} / ${formatFileSize(moduleVideoUploadState?.totalBytes)}`}
                                  </p>
                                )}
                                {(moduleVideoUploadState?.status === 'uploading' || moduleVideoUploadState?.status === 'processing') && (
                                  <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                    {formatUploadSpeed(moduleVideoUploadState?.speedBytesPerSecond) || 'Calculating upload speed...'}
                                  </p>
                                )}
                              </div>
                            ) : null}
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
                  disabled={isSavingCourse || isAnyUploadInProgress}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm shadow-indigo-200 flex items-center gap-2"
                >
                  {(isSavingCourse || isAnyUploadInProgress) && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {isSavingCourse
                    ? 'Saving...'
                    : isAnyUploadInProgress
                      ? 'Upload in progress...'
                      : editingCourseId
                        ? 'Update Course'
                        : 'Create Course'}
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
  onManageCoupons: () => void;
}> = ({ course, enrolledCount, onEdit, onDelete, onView, onManageCoupons }) => {
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
          src={course.thumbnail || DEFAULT_COURSE_THUMBNAIL_PLACEHOLDER}
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
            onClick={onManageCoupons}
            disabled={isFreeCourse}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              isFreeCourse
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <TicketPercent className="w-3.5 h-3.5" />
            Coupons
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
  courseThumbnailUploadState,
  uploadingModuleVideoKey,
  moduleVideoUploadStateByKey,
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
  onResetCourseThumbnailUploadState,
  onUploadModuleVideo,
  onUploadModuleResources,
  onUpdateCourseModuleResource,
  onRemoveCourseModuleResource,
  onAddUrlModuleResource,
  getEditableModuleKey,
  onGetCourseCoupons,
  onCreateCourseCoupon,
  onUpdateCourseCoupon,
  onToggleCourseCouponStatus,
  onDeleteCourseCoupon,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [couponCourse, setCouponCourse] = useState<Course | null>(null);
  const [courseCoupons, setCourseCoupons] = useState<CourseCoupon[]>([]);
  const [couponForm, setCouponForm] = useState<CouponFormData>(INITIAL_COUPON_FORM);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [isSavingCoupon, setIsSavingCoupon] = useState(false);
  const [couponDeleteTarget, setCouponDeleteTarget] = useState<CourseCoupon | null>(null);

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
        result.sort((a, b) => {
          const timeDelta = getEntityTimestamp(b) - getEntityTimestamp(a);
          if (timeDelta !== 0) {
            return timeDelta;
          }
          return b.id.localeCompare(a.id);
        });
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

  const handleSaveAndClose = async (e: React.FormEvent) => {
    const didSave = await onSaveCourse(e);
    if (didSave) {
      setIsEditorOpen(false);
    }

    return didSave;
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      const didDelete = await onDeleteCourse(deleteTarget.id);
      if (didDelete) {
        setDeleteTarget(null);
      }
    }
  };

  const resetCouponForm = () => {
    setCouponForm(INITIAL_COUPON_FORM);
    setEditingCouponId(null);
  };

  const loadCourseCoupons = async (courseId: string) => {
    setCouponError(null);
    setIsLoadingCoupons(true);
    try {
      const coupons = await onGetCourseCoupons(courseId);
      setCourseCoupons(coupons);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load coupons.';
      setCouponError(message);
      setCourseCoupons([]);
    } finally {
      setIsLoadingCoupons(false);
    }
  };

  const openCouponManager = async (course: Course) => {
    if (course.isFree || course.price <= 0) {
      return;
    }

    setCouponCourse(course);
    setCouponSuccess(null);
    setCouponError(null);
    setCouponDeleteTarget(null);
    resetCouponForm();
    await loadCourseCoupons(course.id);
  };

  const closeCouponManager = () => {
    setCouponCourse(null);
    setCourseCoupons([]);
    setCouponError(null);
    setCouponSuccess(null);
    setCouponDeleteTarget(null);
    resetCouponForm();
  };

  const startEditCoupon = (coupon: CourseCoupon) => {
    setCouponError(null);
    setCouponSuccess(null);
    setEditingCouponId(coupon.id);
    setCouponForm({
      code: coupon.code,
      discountPercentage: String(coupon.discountPercentage),
      expiresAt: toDateTimeLocalInput(coupon.expiresAt),
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      isActive: coupon.isActive,
    });
  };

  const handleSaveCoupon = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!couponCourse) {
      return;
    }

    const code = couponForm.code.trim().toUpperCase();
    const discountPercentage = Number(couponForm.discountPercentage);
    const usageLimitValue = couponForm.usageLimit.trim();
    const usageLimit = usageLimitValue ? Number(usageLimitValue) : undefined;

    if (!code) {
      setCouponError('Coupon code is required.');
      return;
    }

    if (!Number.isFinite(discountPercentage) || discountPercentage < 1 || discountPercentage > 100) {
      setCouponError('Discount percentage must be between 1 and 100.');
      return;
    }

    if (usageLimitValue && (!Number.isInteger(usageLimit) || Number(usageLimit) <= 0)) {
      setCouponError('Usage limit must be a positive whole number.');
      return;
    }

    const expiresAt = couponForm.expiresAt
      ? new Date(couponForm.expiresAt).toISOString()
      : undefined;

    setCouponError(null);
    setCouponSuccess(null);
    setIsSavingCoupon(true);

    try {
      if (editingCouponId) {
        const updatedCoupon = await onUpdateCourseCoupon(couponCourse.id, editingCouponId, {
          code,
          discountPercentage,
          isActive: couponForm.isActive,
          expiresAt: expiresAt ?? null,
          usageLimit: usageLimit ?? null,
        });

        setCourseCoupons((prev) => prev.map((coupon) => (
          coupon.id === updatedCoupon.id ? updatedCoupon : coupon
        )));
        setCouponSuccess(`Coupon ${updatedCoupon.code} updated.`);
      } else {
        const createdCoupon = await onCreateCourseCoupon(couponCourse.id, {
          code,
          discountPercentage,
          isActive: couponForm.isActive,
          expiresAt,
          usageLimit,
        });

        setCourseCoupons((prev) => [createdCoupon, ...prev]);
        setCouponSuccess(`Coupon ${createdCoupon.code} created.`);
      }

      resetCouponForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save coupon.';
      setCouponError(message);
    } finally {
      setIsSavingCoupon(false);
    }
  };

  const handleToggleCouponStatus = async (coupon: CourseCoupon) => {
    if (!couponCourse) {
      return;
    }

    setCouponError(null);
    setCouponSuccess(null);

    try {
      const updatedCoupon = await onToggleCourseCouponStatus(
        couponCourse.id,
        coupon.id,
        !coupon.isActive
      );
      setCourseCoupons((prev) => prev.map((item) => (
        item.id === updatedCoupon.id ? updatedCoupon : item
      )));
      setCouponSuccess(`Coupon ${updatedCoupon.code} ${updatedCoupon.isActive ? 'activated' : 'paused'}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update coupon status.';
      setCouponError(message);
    }
  };

  const handleConfirmCouponDelete = async () => {
    if (!couponCourse || !couponDeleteTarget) {
      return;
    }

    setCouponError(null);
    setCouponSuccess(null);

    try {
      await onDeleteCourseCoupon(couponCourse.id, couponDeleteTarget.id);
      setCourseCoupons((prev) => prev.filter((coupon) => coupon.id !== couponDeleteTarget.id));
      setCouponSuccess(`Coupon ${couponDeleteTarget.code} deleted.`);
      setCouponDeleteTarget(null);
      if (editingCouponId === couponDeleteTarget.id) {
        resetCouponForm();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete coupon.';
      setCouponError(message);
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
            Manage Courses
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
                  onManageCoupons={() => {
                    void openCouponManager(course);
                  }}
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
        courseThumbnailUploadState={courseThumbnailUploadState}
        uploadingModuleVideoKey={uploadingModuleVideoKey}
        moduleVideoUploadStateByKey={moduleVideoUploadStateByKey}
        uploadingModuleResourcesKey={uploadingModuleResourcesKey}
        stemSubjects={stemSubjects}
        onSave={handleSaveAndClose}
        onClose={handleCloseEditor}
        onAddModule={onAddCourseModule}
        onRemoveModule={onRemoveCourseModule}
        onUpdateModule={onUpdateCourseModule}
        onUploadThumbnail={onUploadCourseThumbnail}
        onResetThumbnailUploadState={onResetCourseThumbnailUploadState}
        onUploadModuleVideo={onUploadModuleVideo}
        onUploadModuleResources={onUploadModuleResources}
        onUpdateModuleResource={onUpdateCourseModuleResource}
        onRemoveModuleResource={onRemoveCourseModuleResource}
        onAddUrlModuleResource={onAddUrlModuleResource}
        getEditableModuleKey={getEditableModuleKey}
      />

      {/* ═══ Coupon Manager ═══ */}
      <AnimatePresence>
        {couponCourse && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] bg-black/45 backdrop-blur-sm"
              onClick={closeCouponManager}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="fixed inset-x-4 top-6 z-[211] mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex max-h-[88vh] flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                  <div>
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-700">
                      <TicketPercent className="h-3.5 w-3.5" />
                      Coupon Manager
                    </p>
                    <h3 className="mt-2 text-xl font-extrabold text-slate-900">{couponCourse.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Configure private coupon codes for this paid course.
                    </p>
                  </div>
                  <button
                    onClick={closeCouponManager}
                    className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[360px_1fr]">
                  <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {editingCouponId ? 'Edit Coupon' : 'Create Coupon'}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Codes are hidden from students until they enter one at checkout.
                    </p>

                    <form onSubmit={handleSaveCoupon} className="mt-4 space-y-3">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Coupon Code
                        </label>
                        <input
                          type="text"
                          value={couponForm.code}
                          onChange={(event) => setCouponForm((prev) => ({
                            ...prev,
                            code: event.target.value.toUpperCase(),
                          }))}
                          placeholder="e.g., STEM25"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold tracking-wide uppercase text-slate-700 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          maxLength={32}
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Discount Percentage
                        </label>
                        <div className="relative">
                          <Percent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={couponForm.discountPercentage}
                            onChange={(event) => setCouponForm((prev) => ({
                              ...prev,
                              discountPercentage: event.target.value,
                            }))}
                            placeholder="10"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Expiry (Optional)
                        </label>
                        <div className="relative">
                          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="datetime-local"
                            value={couponForm.expiresAt}
                            onChange={(event) => setCouponForm((prev) => ({
                              ...prev,
                              expiresAt: event.target.value,
                            }))}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Usage Limit (Optional)
                        </label>
                        <div className="relative">
                          <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            min="1"
                            value={couponForm.usageLimit}
                            onChange={(event) => setCouponForm((prev) => ({
                              ...prev,
                              usageLimit: event.target.value,
                            }))}
                            placeholder="Unlimited"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={couponForm.isActive}
                          onChange={(event) => setCouponForm((prev) => ({
                            ...prev,
                            isActive: event.target.checked,
                          }))}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        Coupon is active
                      </label>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingCoupon}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSavingCoupon && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          )}
                          {editingCouponId ? 'Update Coupon' : 'Create Coupon'}
                        </button>
                        {editingCouponId && (
                          <button
                            type="button"
                            onClick={resetCouponForm}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div className="flex flex-col p-6">
                    {(couponError || couponSuccess) && (
                      <div
                        className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                          couponError
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {couponError || couponSuccess}
                      </div>
                    )}

                    {isLoadingCoupons ? (
                      <div className="flex flex-1 items-center justify-center">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
                          Loading coupons...
                        </div>
                      </div>
                    ) : courseCoupons.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                        <div>
                          <p className="text-sm font-bold text-slate-700">No coupons yet</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Create your first coupon to drive enrollments for this course.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 overflow-y-auto pr-1">
                        {courseCoupons.map((coupon) => {
                          const usageLabel = coupon.usageLimit
                            ? `${coupon.usageCount} / ${coupon.usageLimit} used`
                            : `${coupon.usageCount} used`;

                          return (
                            <div
                              key={coupon.id}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="text-lg font-black tracking-wide text-slate-900">{coupon.code}</p>
                                  <p className="text-xs font-semibold text-slate-500">
                                    {coupon.discountPercentage}% off • {usageLabel}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
                                    coupon.isActive
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {coupon.isActive ? 'Active' : 'Paused'}
                                </span>
                              </div>

                              <p className="mt-2 text-xs text-slate-500">
                                Expires: {formatDateTimeLabel(coupon.expiresAt)}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => startEditCoupon(coupon)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    void handleToggleCouponStatus(coupon);
                                  }}
                                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                                    coupon.isActive
                                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {coupon.isActive ? (
                                    <ToggleRight className="h-3.5 w-3.5" />
                                  ) : (
                                    <ToggleLeft className="h-3.5 w-3.5" />
                                  )}
                                  {coupon.isActive ? 'Pause' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => setCouponDeleteTarget(coupon)}
                                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

      <ConfirmDialog
        isOpen={!!couponDeleteTarget}
        title="Delete Coupon"
        message={`Delete coupon "${couponDeleteTarget?.code}"? Students will no longer be able to use it.`}
        confirmLabel="Delete Coupon"
        variant="danger"
        onConfirm={handleConfirmCouponDelete}
        onCancel={() => setCouponDeleteTarget(null)}
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
                  src={previewCourse.thumbnail || DEFAULT_COURSE_THUMBNAIL_PLACEHOLDER}
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
