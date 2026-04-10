import {
  User,
  Tutor,
  Review,
  Course,
  Resource,
  Booking,
  Question,
  Quiz,
  StudyPlan,
  SkillLevel,
  CourseEnrollment,
  CourseModuleResource,
  CourseCoupon,
  AppNotification,
  WithdrawalRequest,
  WithdrawalSummary,
  MessageConversation,
  DirectMessage,
  MessageConversationsResponse,
  ConversationMessagesResponse,
} from '../types';
import { normalizeTutorSubjects } from '../data/tutorSubjects';

const LOCALHOST_API_BASE_URL = 'http://localhost:3000/api';
const LOOPBACK_API_BASE_URL = 'http://127.0.0.1:3000/api';
const API_UNAUTHORIZED_EVENT = 'tutorsphere:api-unauthorized';

const resolveApiBaseUrl = (): string => {
  const runtimeOverride = ((window as any).__TUTORSPHERE_API_BASE_URL__ as string | undefined)?.trim();
  if (runtimeOverride) {
    return runtimeOverride;
  }

  const envOverride = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
  if (envOverride) {
    return envOverride;
  }

  const origin = String(window.location.origin || '').trim();
  if (!origin || origin === 'null') {
    return LOCALHOST_API_BASE_URL;
  }

  return `${origin}/api`;
};

const API_BASE_URL = resolveApiBaseUrl();

const getDownloadFileName = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] || null;
};

type UploadedCourseAsset = {
  path: string;
  url?: string;
  blobUrl?: string;
  blobName?: string;
  originalName: string;
  size: number;
  mimeType: string;
};

const getApiBaseCandidates = (): string[] => {
  const candidates = [API_BASE_URL];
  const hostname = window.location.hostname;
  const isFileProtocol = window.location.protocol === 'file:';

  if (isFileProtocol || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    candidates.push(LOCALHOST_API_BASE_URL, LOOPBACK_API_BASE_URL);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

const isSameHostApiBase = (baseUrl: string): boolean => {
  try {
    const parsedUrl = new URL(baseUrl, window.location.origin);
    return parsedUrl.host === window.location.host;
  } catch {
    return false;
  }
};

const shouldRetryApiRequest = (error: unknown): boolean => {
  const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('load failed') ||
    message.includes('failed to fetch') ||
    message.includes('failed to parse url') ||
    message.includes('invalid url') ||
    message.includes('did not match the expected pattern') ||
    message.includes('network') ||
    message.includes('cors')
  );
};

const uploadResourceWithProgress = (
  fullUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadedCourseAsset> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('resource', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', fullUrl, true);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }

      const progress = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onProgress(progress);
    };

    xhr.onerror = () => {
      reject(new Error('Load failed while uploading resource file. Please check your server connection and try again.'));
    };

    xhr.onabort = () => {
      reject(new Error('Resource upload was cancelled.'));
    };

    xhr.onload = () => {
      const raw = xhr.responseText || '';
      let parsed: any = null;

      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        const resolvedPath =
          (parsed && typeof parsed.blobUrl === 'string' && parsed.blobUrl.trim()) ||
          (parsed && typeof parsed.url === 'string' && parsed.url.trim()) ||
          (parsed && typeof parsed.path === 'string' && parsed.path.trim()) ||
          '';

        if (!resolvedPath) {
          reject(new Error('Upload succeeded but response format was invalid.'));
          return;
        }

        onProgress?.(100);
        resolve({
          ...(parsed || {}),
          path: resolvedPath,
          url: typeof parsed?.url === 'string' ? parsed.url : resolvedPath,
          blobUrl: typeof parsed?.blobUrl === 'string' ? parsed.blobUrl : resolvedPath,
        } as UploadedCourseAsset);
        return;
      }

      const errorMessage =
        (parsed && typeof parsed.error === 'string' && parsed.error) ||
        `API request failed: ${xhr.statusText || `HTTP ${xhr.status}`}`;

      reject(new Error(errorMessage));
    };

    xhr.send(formData);
  });
};

type QuizChatSessionStage =
  | 'awaitingSubject'
  | 'awaitingTopic'
  | 'quiz'
  | 'awaitingRestart'
  | 'closed';

export type QuizChatResponse = {
  reply: string;
  stage: QuizChatSessionStage;
  sessionEnded: boolean;
};

export type FaqChatResponse = {
  reply: string;
};

export type ForgotPasswordResponse = {
  message: string;
  cooldownSeconds: number;
  otpExpiryMinutes: number;
};

export type VerifyPasswordOtpResponse = {
  message: string;
  resetToken: string;
  resetTokenExpiryMinutes: number;
};

export type ResetPasswordResponse = {
  message: string;
};

export type ChangePasswordResponse = {
  message: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};

class ApiService {
  private shouldNotifyUnauthorized(endpoint: string): boolean {
    const normalized = endpoint.trim().toLowerCase();
    if (!normalized.startsWith('/auth/')) {
      return true;
    }

    return ![
      '/auth/login',
      '/auth/signup',
      '/auth/forgot-password',
      '/auth/resend-otp',
      '/auth/verify-otp',
      '/auth/reset-password',
    ].includes(normalized);
  }

  private notifyUnauthorized(endpoint: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(API_UNAUTHORIZED_EVENT, {
        detail: { endpoint },
      })
    );
  }

  private sanitizeTutorName(value: string): string {
    return value.replace(/\s+updated\s*$/i, '').trim();
  }

  private normalizeTeachingLevel(value: unknown): Tutor['teachingLevel'] {
    const raw = String(value || '').trim();
    if (raw === 'Both' || raw === 'School & University') {
      return 'School and University';
    }
    if (raw === 'School and University') {
      return raw;
    }
    if (raw === 'School' || raw === 'University') {
      return raw;
    }
    return 'School';
  }

  private normalizeTutor(tutor: any): Tutor {
    const normalizedSubjects = normalizeTutorSubjects(tutor?.subjects);
    const firstName = this.sanitizeTutorName((tutor?.firstName || '').trim());
    const lastName = this.sanitizeTutorName((tutor?.lastName || '').trim());
    const fullName = this.sanitizeTutorName((tutor?.name || '').trim());

    if (firstName || lastName) {
      return {
        ...tutor,
        subjects: normalizedSubjects,
        teachingLevel: this.normalizeTeachingLevel(tutor?.teachingLevel),
      } as Tutor;
    }

    if (fullName) {
      const [parsedFirstName, ...rest] = fullName.split(' ');
      return {
        ...tutor,
        firstName: parsedFirstName || 'Tutor',
        lastName: rest.join(' '),
        subjects: normalizedSubjects,
        teachingLevel: this.normalizeTeachingLevel(tutor?.teachingLevel),
      } as Tutor;
    }

    return {
      ...tutor,
      firstName: 'Tutor',
      lastName: '',
      subjects: normalizedSubjects,
      teachingLevel: this.normalizeTeachingLevel(tutor?.teachingLevel),
    } as Tutor;
  }

  private getResourceNameFromUrl(url: string, fallback = 'Resource'): string {
    const trimmed = String(url || '').trim();
    if (!trimmed) {
      return fallback;
    }

    try {
      if (/^https?:\/\//i.test(trimmed)) {
        const parsed = new URL(trimmed);
        const baseName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
        return baseName || fallback;
      }
    } catch {
      // Fallback to path parsing below.
    }

    const baseName = decodeURIComponent(trimmed.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '');
    return baseName || fallback;
  }

  private normalizeCourseModuleResource(resource: any, index: number): CourseModuleResource | null {
    if (typeof resource === 'string') {
      const value = resource.trim();
      if (!value) {
        return null;
      }
      return {
        name: this.getResourceNameFromUrl(value, `Resource ${index + 1}`),
        url: value,
      };
    }

    const url = String(resource?.url ?? resource?.path ?? '').trim();
    if (!url) {
      return null;
    }

    const name = String(resource?.name ?? '').trim() || this.getResourceNameFromUrl(url, `Resource ${index + 1}`);
    const blobName = String(resource?.blobName ?? '').trim();
    const mimeType = String(resource?.mimeType ?? '').trim();
    const parsedSize = Number(resource?.size);

    return {
      name,
      url,
      blobName: blobName || undefined,
      mimeType: mimeType || undefined,
      size: Number.isFinite(parsedSize) && parsedSize >= 0 ? parsedSize : undefined,
    };
  }

  private normalizeCourse(course: any): Course {
    const modules = Array.isArray(course?.modules)
      ? course.modules.map((module: any) => ({
        ...module,
        resources: (Array.isArray(module?.resources) ? module.resources : [])
          .map((resource: any, index: number) => this.normalizeCourseModuleResource(resource, index))
          .filter((resource: CourseModuleResource | null): resource is CourseModuleResource => Boolean(resource)),
      }))
      : [];

    return {
      ...course,
      modules,
    } as Course;
  }

  private normalizeResource(resource: any): Resource {
    const normalizedId = String(resource?.id ?? resource?._id ?? '').trim();
    const parsedDownloadCount = Number(resource?.downloadCount);

    return {
      ...resource,
      id: normalizedId,
      downloadCount: Number.isFinite(parsedDownloadCount) ? Math.max(0, parsedDownloadCount) : 0,
    } as Resource;
  }

  private async fetchWithApiFallback(endpoint: string, options?: RequestInit, expectJson = false): Promise<Response> {
    const baseCandidates = getApiBaseCandidates();
    let lastError: unknown;

    for (let index = 0; index < baseCandidates.length; index += 1) {
      const baseUrl = baseCandidates[index];
      const isLastCandidate = index === baseCandidates.length - 1;

      try {
        const response = await fetch(`${baseUrl}${endpoint}`, options);

        if (expectJson && response.ok) {
          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          const isJsonLike =
            contentType.includes('application/json') ||
            contentType.includes('application/problem+json') ||
            contentType.includes('+json');

          // Some dev setups can return SPA HTML for missing API routes.
          if (!isJsonLike && !isLastCandidate) {
            continue;
          }
        }

        if (
          !isLastCandidate &&
          (response.status === 404 || response.status === 405) &&
          !isSameHostApiBase(baseUrl)
        ) {
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        const canRetryByType =
          error instanceof TypeError ||
          (typeof DOMException !== 'undefined' && error instanceof DOMException);

        if (isLastCandidate || (!canRetryByType && !shouldRetryApiRequest(error))) {
          throw error;
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('Failed to reach TutorSphere API.');
  }

  private async createApiError(response: Response, defaultMessage = 'API request failed'): Promise<Error> {
    let errorMessage = `${defaultMessage}: ${response.statusText || `HTTP ${response.status}`}`;
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Keep default message when response body is not JSON
    }
    return new Error(errorMessage);
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const isFormDataBody = options?.body instanceof FormData;
    const requestOptions: RequestInit = {
      ...options,
      credentials: options?.credentials ?? 'include',
      headers: isFormDataBody
        ? options?.headers
        : {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
    };

    const response = await this.fetchWithApiFallback(endpoint, requestOptions, true);

    if (!response.ok) {
      if (response.status === 401 && this.shouldNotifyUnauthorized(endpoint)) {
        this.notifyUnauthorized(endpoint);
      }
      throw await this.createApiError(response);
    }

    try {
      return await response.json();
    } catch {
      throw new Error('The API returned an invalid response format. Please restart the TutorSphere server and try again.');
    }
  }

  // Auth methods
  async login(email: string, password: string, rememberMe = false): Promise<User> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });
  }

  async signup(firstName: string, lastName: string, email: string, password: string, role?: string): Promise<User> {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email, password, role }),
    });
  }

  async logout(): Promise<{ message: string }> {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resendPasswordResetOtp(email: string): Promise<ForgotPasswordResponse> {
    return this.request('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyPasswordResetOtp(email: string, otp: string): Promise<VerifyPasswordOtpResponse> {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resetPassword(
    email: string,
    resetToken: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<ResetPasswordResponse> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, resetToken, newPassword, confirmPassword }),
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<ChangePasswordResponse> {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ userId, currentPassword, newPassword, confirmPassword }),
    });
  }

  async updateUser(id: string, data: FormData | { firstName?: string; lastName?: string; phone?: string }): Promise<User> {
    const isFormData = data instanceof FormData;
    if (isFormData) {
      return this.request(`/auth/user/${id}`, {
        method: 'PUT',
        body: data,
      });
    }

    return this.request(`/auth/user/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    return this.request(`/auth/user/${id}`, {
      method: 'DELETE',
    });
  }

  // Tutor methods
  async getTutors(): Promise<Tutor[]> {
    const tutors = await this.request<any[]>('/tutors');
    return tutors.map((tutor) => this.normalizeTutor(tutor));
  }

  async getTutor(id: string): Promise<Tutor> {
    const tutor = await this.request<any>(`/tutors/${id}`);
    return this.normalizeTutor(tutor);
  }

  async createTutor(tutor: Omit<Tutor, 'id'>): Promise<Tutor> {
    const payload = {
      ...tutor,
      subjects: normalizeTutorSubjects(tutor.subjects),
    };

    const createdTutor = await this.request<any>('/tutors', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return this.normalizeTutor(createdTutor);
  }

  async updateTutor(id: string, tutor: Partial<Tutor>): Promise<Tutor> {
    const payload: Partial<Tutor> = {
      ...tutor,
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'subjects')) {
      payload.subjects = normalizeTutorSubjects(payload.subjects);
    }

    const updatedTutor = await this.request<any>(`/tutors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return this.normalizeTutor(updatedTutor);
  }

  async deleteTutor(id: string): Promise<void> {
    return this.request(`/tutors/${id}`, {
      method: 'DELETE',
    });
  }

  // Review methods
  async getReviews(): Promise<Review[]> {
    return this.request('/reviews');
  }

  async getTutorReviews(tutorId: string): Promise<Review[]> {
    return this.request(`/reviews/${tutorId}`);
  }

  async createReview(review: Omit<Review, 'id'>): Promise<Review> {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(review),
    });
  }

  async updateReview(id: string, review: Partial<Review>): Promise<Review> {
    return this.request(`/reviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(review),
    });
  }

  async deleteReview(id: string): Promise<void> {
    return this.request(`/reviews/${id}`, {
      method: 'DELETE',
    });
  }

  // Course methods
  async getCourses(filters?: { tutorId?: string }): Promise<Course[]> {
    const params = new URLSearchParams();
    if (filters?.tutorId) {
      params.set('tutorId', filters.tutorId);
    }
    const query = params.toString();
    const courses = await this.request<any[]>(`/courses${query ? `?${query}` : ''}`);
    return courses.map((course) => this.normalizeCourse(course));
  }

  async getCourse(id: string): Promise<Course> {
    const course = await this.request<any>(`/courses/${id}`);
    return this.normalizeCourse(course);
  }

  async createCourse(course: Omit<Course, 'id'>): Promise<Course> {
    const createdCourse = await this.request<any>('/courses', {
      method: 'POST',
      body: JSON.stringify(course),
    });
    return this.normalizeCourse(createdCourse);
  }

  async updateCourse(id: string, course: Partial<Course>, actorId?: string): Promise<Course> {
    const params = new URLSearchParams();
    if (actorId) {
      params.set('actorId', actorId);
    }
    const query = params.toString();
    const updatedCourse = await this.request<any>(`/courses/${id}${query ? `?${query}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify({ ...course, actorId }),
    });
    return this.normalizeCourse(updatedCourse);
  }

  async uploadCourseThumbnail(file: File): Promise<UploadedCourseAsset> {
    const formData = new FormData();
    formData.append('thumbnail', file);
    return this.request('/uploads/course-thumbnail', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadCourseModuleVideo(file: File): Promise<UploadedCourseAsset> {
    const formData = new FormData();
    formData.append('video', file);
    return this.request('/uploads/course-video', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadCourseModuleResource(file: File): Promise<UploadedCourseAsset> {
    const formData = new FormData();
    formData.append('resource', file);
    return this.request('/uploads/course-resource', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadTutorCertificate(file: File): Promise<UploadedCourseAsset> {
    const formData = new FormData();
    formData.append('certificate', file);
    return this.request('/uploads/tutor-certificate', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadRecordedLesson(file: File): Promise<UploadedCourseAsset> {
    const formData = new FormData();
    formData.append('lesson', file);
    return this.request('/uploads/recorded-lesson', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadTutorResource(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadedCourseAsset> {
    const baseCandidates = getApiBaseCandidates();
    const uploadEndpoints = ['/uploads/tutor-resource', '/uploads/course-resource'];
    let lastError: unknown;

    for (const endpoint of uploadEndpoints) {
      for (const baseUrl of baseCandidates) {
        try {
          return await uploadResourceWithProgress(`${baseUrl}${endpoint}`, file, onProgress);
        } catch (error) {
          lastError = error;
          if (!shouldRetryApiRequest(error)) {
            throw error;
          }
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error('Failed to upload resource file.');
  }

  async deleteCourse(id: string, actorId?: string): Promise<void> {
    const params = new URLSearchParams();
    if (actorId) {
      params.set('actorId', actorId);
    }
    const query = params.toString();
    return this.request(`/courses/${id}${query ? `?${query}` : ''}`, {
      method: 'DELETE',
    });
  }

  async enrollInCourse(
    courseId: string,
    studentId: string,
    options?: { paymentConfirmed?: boolean; paymentReference?: string; couponCode?: string }
  ): Promise<Course> {
    return this.request(`/courses/${courseId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        paymentConfirmed: Boolean(options?.paymentConfirmed),
        paymentReference: options?.paymentReference?.trim() || undefined,
        couponCode: options?.couponCode?.trim() || undefined,
      }),
    });
  }

  async getCourseCoupons(courseId: string, actorId: string): Promise<CourseCoupon[]> {
    const params = new URLSearchParams({ actorId });
    return this.request(`/courses/${courseId}/coupons?${params.toString()}`);
  }

  async createCourseCoupon(
    courseId: string,
    payload: {
      actorId: string;
      code: string;
      discountPercentage: number;
      isActive?: boolean;
      expiresAt?: string;
      usageLimit?: number;
    }
  ): Promise<CourseCoupon> {
    return this.request(`/courses/${courseId}/coupons`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateCourseCoupon(
    courseId: string,
    couponId: string,
    payload: {
      actorId: string;
      code?: string;
      discountPercentage?: number;
      isActive?: boolean;
      expiresAt?: string | null;
      usageLimit?: number | null;
    }
  ): Promise<CourseCoupon> {
    return this.request(`/courses/${courseId}/coupons/${couponId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async toggleCourseCouponStatus(
    courseId: string,
    couponId: string,
    payload: { actorId: string; isActive: boolean }
  ): Promise<CourseCoupon> {
    return this.request(`/courses/${courseId}/coupons/${couponId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteCourseCoupon(courseId: string, couponId: string, actorId: string): Promise<void> {
    const params = new URLSearchParams({ actorId });
    return this.request(`/courses/${courseId}/coupons/${couponId}?${params.toString()}`, {
      method: 'DELETE',
    });
  }

  async validateCourseCoupon(
    courseId: string,
    payload: { studentId: string; couponCode: string }
  ): Promise<{
    valid: boolean;
    couponCode: string;
    discountPercentage: number;
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
  }> {
    return this.request(`/courses/${courseId}/coupons/validate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async unenrollFromCourse(courseId: string, studentId: string): Promise<void> {
    return this.request(`/courses/${courseId}/unenroll`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
  }

  async getCourseEnrollments(filters?: { studentId?: string; tutorId?: string; courseId?: string }): Promise<CourseEnrollment[]> {
    const params = new URLSearchParams();
    if (filters?.studentId) {
      params.set('studentId', filters.studentId);
    }
    if (filters?.tutorId) {
      params.set('tutorId', filters.tutorId);
    }
    if (filters?.courseId) {
      params.set('courseId', filters.courseId);
    }
    const query = params.toString();
    return this.request(`/course-enrollments${query ? `?${query}` : ''}`);
  }

  async updateCourseProgress(enrollmentId: string, studentId: string, completedModuleIds: string[]): Promise<CourseEnrollment> {
    return this.request(`/course-enrollments/${enrollmentId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({ studentId, completedModuleIds }),
    });
  }

  async getWithdrawalRequests(tutorId: string): Promise<WithdrawalRequest[]> {
    const params = new URLSearchParams({ tutorId });
    return this.request(`/withdrawals?${params.toString()}`);
  }

  async getWithdrawalSummary(tutorId: string): Promise<WithdrawalSummary> {
    const params = new URLSearchParams({ tutorId });
    return this.request(`/withdrawals/summary?${params.toString()}`);
  }

  async createWithdrawalRequest(payload: {
    tutorId: string;
    amount: number;
    payoutMethodType: WithdrawalRequest['payoutMethodType'];
    payoutMethodDetails: string;
  }): Promise<WithdrawalRequest> {
    return this.request('/withdrawals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async downloadCourseCertificate(enrollmentId: string, studentId: string, fileBaseName: string): Promise<void> {
    const response = await this.fetchWithApiFallback(
      `/course-enrollments/${enrollmentId}/certificate?studentId=${encodeURIComponent(studentId)}`
    );

    if (!response.ok) {
      throw await this.createApiError(response, 'Certificate download failed');
    }

    const blob = await response.blob();
    const suggestedFileName = getDownloadFileName(response.headers.get('Content-Disposition'));
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download =
      suggestedFileName ||
      `${fileBaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-certificate.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  // Resource methods
  async getResources(filters?: { tutorId?: string; freeOnly?: boolean }): Promise<Resource[]> {
    const params = new URLSearchParams();
    if (filters?.tutorId) {
      params.set('tutorId', filters.tutorId);
    }
    if (filters?.freeOnly) {
      params.set('freeOnly', 'true');
    }
    const query = params.toString();
    const resources = await this.request<any[]>(`/resources${query ? `?${query}` : ''}`);
    return resources.map((resource) => this.normalizeResource(resource));
  }

  async createResource(resource: Omit<Resource, 'id' | 'downloadCount'>): Promise<Resource> {
    const createdResource = await this.request<any>('/resources', {
      method: 'POST',
      body: JSON.stringify(resource),
    });
    return this.normalizeResource(createdResource);
  }

  async incrementResourceDownload(id: string): Promise<Resource> {
    const updatedResource = await this.request<any>(`/resources/${id}/download`, {
      method: 'POST',
    });
    return this.normalizeResource(updatedResource);
  }

  async updateResource(id: string, resource: Partial<Resource>, actorId?: string): Promise<Resource> {
    const params = new URLSearchParams();
    if (actorId) {
      params.set('actorId', actorId);
    }
    const query = params.toString();
    const updatedResource = await this.request<any>(`/resources/${id}${query ? `?${query}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify({ ...resource, actorId }),
    });
    return this.normalizeResource(updatedResource);
  }

  async deleteResource(id: string, actorId?: string): Promise<void> {
    const params = new URLSearchParams();
    if (actorId) {
      params.set('actorId', actorId);
    }
    const query = params.toString();
    return this.request(`/resources/${id}${query ? `?${query}` : ''}`, {
      method: 'DELETE',
    });
  }

  // Booking methods
  async getBookings(): Promise<Booking[]> {
    return this.request('/bookings');
  }

  async createBooking(booking: Omit<Booking, 'id'>): Promise<Booking> {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(booking),
    });
  }

  async updateBooking(id: string, booking: Partial<Booking>): Promise<Booking> {
    return this.request(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(booking),
    });
  }

  async deleteBooking(id: string): Promise<void> {
    return this.request(`/bookings/${id}`, {
      method: 'DELETE',
    });
  }

  async getNotifications(
    userId: string,
    options?: { limit?: number; isRead?: boolean }
  ): Promise<NotificationsResponse> {
    const params = new URLSearchParams({ userId });

    if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
      params.set('limit', String(Math.floor(options.limit)));
    }

    if (typeof options?.isRead === 'boolean') {
      params.set('isRead', String(options.isRead));
    }

    return this.request(`/notifications?${params.toString()}`);
  }

  async createNotification(payload: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    targetTab?: string;
    relatedEntityId?: string;
    isRead?: boolean;
  }): Promise<{ notification: AppNotification; unreadCount: number }> {
    return this.request('/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async markNotificationAsRead(
    notificationId: string,
    userId: string
  ): Promise<{ notification: AppNotification; unreadCount: number }> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
      body: JSON.stringify({ userId }),
    });
  }

  async markAllNotificationsAsRead(userId: string): Promise<{ modifiedCount: number; unreadCount: number }> {
    return this.request('/notifications/read-all', {
      method: 'PUT',
      body: JSON.stringify({ userId }),
    });
  }

  async getMessageConversations(userId: string, search?: string): Promise<MessageConversationsResponse> {
    const params = new URLSearchParams();
    if (userId && userId.trim()) {
      params.set('userId', userId.trim());
    }
    if (search && search.trim()) {
      params.set('search', search.trim());
    }

    const query = params.toString();
    return this.request(`/messages/conversations${query ? `?${query}` : ''}`);
  }

  async getMessageUnreadCount(userId: string): Promise<{ totalUnreadCount: number }> {
    const params = new URLSearchParams();
    if (userId && userId.trim()) {
      params.set('userId', userId.trim());
    }

    const query = params.toString();
    return this.request(`/messages/unread-count${query ? `?${query}` : ''}`);
  }

  async pingMessagePresence(userId: string): Promise<{ isOnline: boolean; lastActiveAt: string | null }> {
    return this.request('/messages/presence/ping', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async openDirectConversation(
    participantUserId: string,
    userId: string
  ): Promise<{ conversation: MessageConversation; created: boolean }> {
    return this.request('/messages/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ participantUserId, userId }),
    });
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    options?: { limit?: number; before?: string }
  ): Promise<ConversationMessagesResponse> {
    const params = new URLSearchParams();

    if (userId && userId.trim()) {
      params.set('userId', userId.trim());
    }

    if (typeof options?.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
      params.set('limit', String(Math.floor(options.limit)));
    }

    if (typeof options?.before === 'string' && options.before.trim()) {
      params.set('before', options.before.trim());
    }

    const query = params.toString();
    return this.request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages${query ? `?${query}` : ''}`);
  }

  async sendConversationMessage(
    conversationId: string,
    content: string,
    userId: string
  ): Promise<{ message: DirectMessage; conversation: MessageConversation; totalUnreadCount: number }> {
    return this.request(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, userId }),
    });
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<{ conversationId: string; unreadCount: number; modifiedCount: number; totalUnreadCount: number }> {
    return this.request(`/messages/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  async deleteConversationMessage(
    conversationId: string,
    messageId: string,
    userId: string
  ): Promise<{ message: DirectMessage; conversation: MessageConversation; totalUnreadCount: number }> {
    const params = new URLSearchParams();
    if (userId && userId.trim()) {
      params.set('userId', userId.trim());
    }

    const query = params.toString();
    return this.request(
      `/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}${query ? `?${query}` : ''}`,
      {
        method: 'DELETE',
      }
    );
  }

  async deleteMessageConversation(
    conversationId: string,
    userId: string
  ): Promise<{ conversationId: string; deletedMessageCount: number; totalUnreadCount: number }> {
    const params = new URLSearchParams();
    if (userId && userId.trim()) {
      params.set('userId', userId.trim());
    }

    const query = params.toString();
    const deleteEndpoint = `/messages/conversations/${encodeURIComponent(conversationId)}${query ? `?${query}` : ''}`;

    try {
      return await this.request(deleteEndpoint, {
        method: 'DELETE',
      });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
      const shouldFallback = message.includes('not found') || message.includes('404');

      if (!shouldFallback) {
        throw error;
      }

      return this.request(
        `/messages/conversations/${encodeURIComponent(conversationId)}/delete`,
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        }
      );
    }
  }

  // Question methods
  async getQuestions(): Promise<Question[]> {
    return this.request('/questions');
  }

  async createQuestion(question: Omit<Question, 'id' | 'timestamp'>): Promise<Question> {
    return this.request('/questions', {
      method: 'POST',
      body: JSON.stringify(question),
    });
  }

  async updateQuestion(id: string, question: Partial<Question>): Promise<Question> {
    return this.request(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(question),
    });
  }

  async deleteQuestion(id: string): Promise<void> {
    return this.request(`/questions/${id}`, {
      method: 'DELETE',
    });
  }

  // Quiz methods
  async getQuizzes(): Promise<Quiz[]> {
    return this.request('/quizzes');
  }

  async createQuiz(quiz: Omit<Quiz, 'id'>): Promise<Quiz> {
    return this.request('/quizzes', {
      method: 'POST',
      body: JSON.stringify(quiz),
    });
  }

  async updateQuiz(id: string, quiz: Partial<Quiz>): Promise<Quiz> {
    return this.request(`/quizzes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(quiz),
    });
  }

  async deleteQuiz(id: string): Promise<void> {
    return this.request(`/quizzes/${id}`, {
      method: 'DELETE',
    });
  }

  // Study Plan methods
  async getStudyPlan(studentId: string): Promise<StudyPlan> {
    return this.request(`/study-plans/${studentId}`);
  }

  async createStudyPlan(studyPlan: Omit<StudyPlan, 'id'>): Promise<StudyPlan> {
    return this.request('/study-plans', {
      method: 'POST',
      body: JSON.stringify(studyPlan),
    });
  }

  async updateStudyPlan(id: string, studyPlan: Partial<StudyPlan>): Promise<StudyPlan> {
    return this.request(`/study-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studyPlan),
    });
  }

  async deleteStudyPlan(id: string): Promise<void> {
    return this.request(`/study-plans/${id}`, {
      method: 'DELETE',
    });
  }

  // Skill Level methods
  async getSkillLevels(studentId: string): Promise<SkillLevel[]> {
    return this.request(`/skill-levels/${studentId}`);
  }

  async createSkillLevel(skillLevel: Omit<SkillLevel, 'id'>): Promise<SkillLevel> {
    return this.request('/skill-levels', {
      method: 'POST',
      body: JSON.stringify(skillLevel),
    });
  }

  async updateSkillLevel(id: string, skillLevel: Partial<SkillLevel>): Promise<SkillLevel> {
    return this.request(`/skill-levels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(skillLevel),
    });
  }

  async deleteSkillLevel(id: string): Promise<void> {
    return this.request(`/skill-levels/${id}`, {
      method: 'DELETE',
    });
  }

  async sendQuizChatMessage(message: string, user: Pick<User, 'id' | 'role'>): Promise<QuizChatResponse> {
    return this.request('/quiz-chatbot/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        userId: user.id,
        role: user.role,
      }),
    });
  }

  async resetQuizChatSession(user: Pick<User, 'id' | 'role'>): Promise<QuizChatResponse> {
    return this.request('/quiz-chatbot/reset', {
      method: 'POST',
      body: JSON.stringify({
        userId: user.id,
        role: user.role,
      }),
    });
  }

  async sendFaqChatMessage(
    message: string,
    context?: {
      currentTab?: string;
      userRole?: string;
      userName?: string;
      aiMode?: 'platform' | 'ask_learn' | 'roadmap_finder';
    }
  ): Promise<FaqChatResponse> {
    return this.request('/faq-chatbot/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        context,
      }),
    });
  }
}

export const apiService = new ApiService();