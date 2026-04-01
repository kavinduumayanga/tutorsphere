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
} from '../types';

const LOCALHOST_API_BASE_URL = 'http://localhost:3000/api';
const LOOPBACK_API_BASE_URL = 'http://127.0.0.1:3000/api';

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

const shouldRetryApiRequest = (error: unknown): boolean => {
  const message = String(error instanceof Error ? error.message : error || '').toLowerCase();
  return (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('load failed') ||
    message.includes('failed to fetch') ||
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
        if (!parsed || typeof parsed.path !== 'string') {
          reject(new Error('Upload succeeded but response format was invalid.'));
          return;
        }

        onProgress?.(100);
        resolve(parsed as UploadedCourseAsset);
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

class ApiService {
  private sanitizeTutorName(value: string): string {
    return value.replace(/\s+updated\s*$/i, '').trim();
  }

  private normalizeTutor(tutor: any): Tutor {
    const firstName = this.sanitizeTutorName((tutor?.firstName || '').trim());
    const lastName = this.sanitizeTutorName((tutor?.lastName || '').trim());
    const fullName = this.sanitizeTutorName((tutor?.name || '').trim());

    if (firstName || lastName) {
      return tutor as Tutor;
    }

    if (fullName) {
      const [parsedFirstName, ...rest] = fullName.split(' ');
      return {
        ...tutor,
        firstName: parsedFirstName || 'Tutor',
        lastName: rest.join(' '),
      } as Tutor;
    }

    return {
      ...tutor,
      firstName: 'Tutor',
      lastName: '',
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
    return { name, url };
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

  private async fetchWithApiFallback(endpoint: string, options?: RequestInit): Promise<Response> {
    const baseCandidates = getApiBaseCandidates();
    let lastError: unknown;

    for (let index = 0; index < baseCandidates.length; index += 1) {
      const baseUrl = baseCandidates[index];
      const isLastCandidate = index === baseCandidates.length - 1;

      try {
        const response = await fetch(`${baseUrl}${endpoint}`, options);

        if (!isLastCandidate && (response.status === 404 || response.status === 405)) {
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (isLastCandidate || !shouldRetryApiRequest(error)) {
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
      headers: isFormDataBody
        ? options?.headers
        : {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
    };

    const response = await this.fetchWithApiFallback(endpoint, requestOptions);

    if (!response.ok) {
      throw await this.createApiError(response);
    }

    return response.json();
  }

  // Auth methods
  async login(email: string, password: string): Promise<User> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signup(firstName: string, lastName: string, email: string, password: string, role?: string): Promise<User> {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, email, password, role }),
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
    return this.request('/tutors', {
      method: 'POST',
      body: JSON.stringify(tutor),
    });
  }

  async updateTutor(id: string, tutor: Partial<Tutor>): Promise<Tutor> {
    return this.request(`/tutors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tutor),
    });
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
    options?: { paymentConfirmed?: boolean; paymentReference?: string }
  ): Promise<Course> {
    return this.request(`/courses/${courseId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        paymentConfirmed: Boolean(options?.paymentConfirmed),
        paymentReference: options?.paymentReference?.trim() || undefined,
      }),
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
    return this.request(`/resources${query ? `?${query}` : ''}`);
  }

  async createResource(resource: Omit<Resource, 'id'>): Promise<Resource> {
    return this.request('/resources', {
      method: 'POST',
      body: JSON.stringify(resource),
    });
  }

  async updateResource(id: string, resource: Partial<Resource>, actorId?: string): Promise<Resource> {
    const params = new URLSearchParams();
    if (actorId) {
      params.set('actorId', actorId);
    }
    const query = params.toString();
    return this.request(`/resources/${id}${query ? `?${query}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify({ ...resource, actorId }),
    });
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
}

export const apiService = new ApiService();