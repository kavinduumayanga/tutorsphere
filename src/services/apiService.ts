import { User, Tutor, Review, Course, Resource, Booking, Question, Quiz, StudyPlan, SkillLevel } from '../types';

const API_BASE_URL = `${window.location.origin}/api`;

class ApiService {
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
    return this.request('/tutors');
  }

  async getTutor(id: string): Promise<Tutor> {
    return this.request(`/tutors/${id}`);
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
  async getCourses(): Promise<Course[]> {
    return this.request('/courses');
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

  async updateCourse(id: string, course: Partial<Course>): Promise<Course> {
    return this.request(`/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(course),
    });
  }

  async deleteCourse(id: string): Promise<void> {
    return this.request(`/courses/${id}`, {
      method: 'DELETE',
    });
  }

  async enrollInCourse(courseId: string, studentId: string): Promise<Course> {
    return this.request(`/courses/${courseId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
  }

  // Resource methods
  async getResources(): Promise<Resource[]> {
    return this.request('/resources');
  }

  async createResource(resource: Omit<Resource, 'id'>): Promise<Resource> {
    return this.request('/resources', {
      method: 'POST',
      body: JSON.stringify(resource),
    });
  }

  async updateResource(id: string, resource: Partial<Resource>): Promise<Resource> {
    return this.request(`/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(resource),
    });
  }

  async deleteResource(id: string): Promise<void> {
    return this.request(`/resources/${id}`, {
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