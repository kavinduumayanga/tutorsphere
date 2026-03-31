import { User, Tutor, Review, Course, Resource, Booking, Question, Quiz, StudyPlan, SkillLevel, CourseEnrollment } from '../types';

const API_BASE_URL = `${window.location.origin}/api`;

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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Keep default message when response body is not JSON
      }
      throw new Error(errorMessage);
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
    return this.request(`/courses${query ? `?${query}` : ''}`);
  }

  async getCourse(id: string): Promise<Course> {
    return this.request(`/courses/${id}`);
  }

  async createCourse(course: Omit<Course, 'id'>): Promise<Course> {
    return this.request('/courses', {
      method: 'POST',
      body: JSON.stringify(course),
    });
  }

  async updateCourse(id: string, course: Partial<Course>, actorId?: string): Promise<Course> {
    const params = new URLSearchParams();
    if (actorId) {
      params.set('actorId', actorId);
    }
    const query = params.toString();
    return this.request(`/courses/${id}${query ? `?${query}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify({ ...course, actorId }),
    });
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
    const response = await fetch(
      `${API_BASE_URL}/course-enrollments/${enrollmentId}/certificate?studentId=${encodeURIComponent(studentId)}`
    );

    if (!response.ok) {
      let errorMessage = `Certificate download failed: ${response.statusText}`;
      try {
        const data = await response.json();
        if (data?.error) {
          errorMessage = data.error;
        }
      } catch {
        // Keep default message
      }
      throw new Error(errorMessage);
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
}

export const apiService = new ApiService();