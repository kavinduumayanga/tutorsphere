// Local service providing offline alternatives for all AI-powered features
// This provides completely local implementations without external dependencies

export const localService = {
  async generateSpeech(text: string) {
    // Mock speech generation - in a real local implementation,
    // you could integrate with local TTS libraries like Web Speech API
    console.log("Speech requested:", text);
    return null; // Return null to disable speech feature
  },

  async askQuestion(question: string, subject: string) {
    // Mock Q&A responses based on subject
    const mockResponses: Record<string, string[]> = {
      'Mathematics': [
        "In mathematics, the fundamental theorem of calculus connects differentiation and integration. The first part states that if f is continuous on [a,b], then the function F defined by F(x) = ∫_a^x f(t) dt is differentiable and F'(x) = f(x).",
        "A derivative measures the rate of change of a function. For f(x) = x², the derivative f'(x) = 2x represents the slope of the tangent line at any point.",
        "Pythagoras' theorem states that in a right-angled triangle, the square of the hypotenuse equals the sum of the squares of the other two sides: a² + b² = c²."
      ],
      'Physics': [
        "Newton's second law states that F = ma, where F is force, m is mass, and a is acceleration. This fundamental principle describes how forces affect motion.",
        "The speed of light in vacuum is approximately 3 × 10^8 m/s. This is a fundamental constant in physics and represents the maximum speed at which information can travel.",
        "Energy cannot be created or destroyed, only transformed from one form to another. This is the law of conservation of energy."
      ],
      'Chemistry': [
        "The periodic table organizes elements by atomic number and chemical properties. Elements in the same group have similar chemical behavior due to their valence electron configuration.",
        "A chemical reaction involves the rearrangement of atoms to form new substances. The law of conservation of mass states that matter cannot be created or destroyed in a chemical reaction.",
        "pH measures the acidity or basicity of a solution. A pH of 7 is neutral, below 7 is acidic, and above 7 is basic."
      ],
      'ICT': [
        "An algorithm is a step-by-step procedure for solving a problem. It must be clear, finite, and effective to be considered valid.",
        "Binary code uses only 0s and 1s to represent data. Each binary digit is called a bit, and 8 bits make a byte.",
        "A database is an organized collection of data that can be easily accessed, managed, and updated. Relational databases use tables with rows and columns."
      ]
    };

    const responses = mockResponses[subject] || mockResponses['Mathematics'];
    return responses[Math.floor(Math.random() * responses.length)];
  },

  async validateTutor(details: any) {
    // Simple local validation logic
    const education = details.education.toLowerCase();
    const subjects = details.subjects.map((s: string) => s.toLowerCase());

    // Check for valid education
    const hasValidEducation = education.includes('degree') ||
                             education.includes('bsc') ||
                             education.includes('msc') ||
                             education.includes('phd') ||
                             education.includes('bachelor') ||
                             education.includes('master') ||
                             education.includes('doctor');

    // Check for STEM subjects
    const stemSubjects = ['mathematics', 'physics', 'chemistry', 'biology', 'ict', 'computer science', 'software engineering'];
    const hasValidSubjects = subjects.some((subject: string) =>
      stemSubjects.some(stem => subject.includes(stem))
    );

    if (!hasValidEducation) {
      return {
        isValid: false,
        reason: "Education qualification not recognized. Please provide details of your degree or relevant certification."
      };
    }

    if (!hasValidSubjects) {
      return {
        isValid: false,
        reason: "Subjects must be STEM or ICT related. Please select appropriate subjects for tutoring."
      };
    }

    return {
      isValid: true,
      reason: "Tutor application validated successfully. Welcome to TutorSphere!"
    };
  },

  async getChatbotResponse(message: string, context: string = "") {
    // Simple rule-based chatbot responses
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('quiz') || lowerMessage.includes('test')) {
      return "Great! You can take quizzes in the Quizzes section. Click on any subject to start a personalized assessment. Would you like me to help you navigate there?";
    }

    if (lowerMessage.includes('tutor') || lowerMessage.includes('find')) {
      return "You can browse available tutors in the 'Find Tutors' section. We have experts in Mathematics, Physics, Chemistry, and ICT. Each tutor profile shows their qualifications and availability.";
    }

    if (lowerMessage.includes('course') || lowerMessage.includes('learn')) {
      return "Check out our Courses section for structured learning paths. We offer courses in Web Development, Pure Mathematics, and more. You can enroll and track your progress.";
    }

    if (lowerMessage.includes('progress') || lowerMessage.includes('skill')) {
      return "Your skill matrix and progress tracking are available in your Dashboard. You can see your current levels in different subjects and get personalized recommendations.";
    }

    if (lowerMessage.includes('study plan') || lowerMessage.includes('schedule')) {
      return "Your personalized study plan is available in the Dashboard. It adapts based on your current skill levels and learning goals.";
    }

    if (lowerMessage.includes('book') || lowerMessage.includes('session')) {
      return "To book a tutoring session, go to the 'Find Tutors' section, select a tutor, and choose an available time slot. You'll need to log in first.";
    }

    // Default helpful responses
    const defaultResponses = [
      "I'm here to help you with TutorSphere! You can ask me about finding tutors, taking quizzes, enrolling in courses, or checking your progress.",
      "Welcome to TutorSphere! How can I assist you today? I can help you find tutors, start quizzes, or navigate the platform.",
      "TutorSphere is your gateway to quality STEM education. What would you like to know about our tutors, courses, or features?"
    ];

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  },

  async generateStudyPlan(skillLevels: any[]) {
    // Mock study plan generation
    const totalHours = skillLevels.reduce((sum: number, skill: any) => {
      const levelHours = { 'Beginner': 10, 'Intermediate': 15, 'Advanced': 20 };
      return sum + (levelHours[skill.level] || 10);
    }, 0);

    const recommendations = [
      "Focus on weak subjects first",
      "Practice regularly with quizzes",
      "Review fundamental concepts weekly",
      "Set specific daily goals"
    ];

    const schedule = [
      { day: "Monday", topic: "Mathematics Fundamentals" },
      { day: "Tuesday", topic: "Physics Concepts" },
      { day: "Wednesday", topic: "Chemistry Basics" },
      { day: "Thursday", topic: "ICT Skills" },
      { day: "Friday", topic: "Mixed Practice" },
      { day: "Saturday", topic: "Review & Assessment" },
      { day: "Sunday", topic: "Rest & Planning" }
    ];

    return {
      weeklyGoalHours: Math.min(totalHours, 40),
      recommendations: recommendations.slice(0, 3),
      schedule: schedule
    };
  },

  async generateQuiz(subject: string, level: string) {
    // Mock quiz generation with predefined questions
    const quizData: Record<string, any> = {
      'Mathematics': {
        questions: [
          {
            question: "What is the derivative of x²?",
            options: ["x", "2x", "x²", "2"],
            correctAnswer: 1
          },
          {
            question: "What is the value of π (pi) approximately?",
            options: ["2.14", "3.14", "4.14", "5.14"],
            correctAnswer: 1
          },
          {
            question: "What is the Pythagorean theorem?",
            options: ["a + b = c", "a × b = c", "a² + b² = c²", "a² - b² = c²"],
            correctAnswer: 2
          }
        ]
      },
      'Physics': {
        questions: [
          {
            question: "What is the SI unit of force?",
            options: ["Watt", "Joule", "Newton", "Pascal"],
            correctAnswer: 2
          },
          {
            question: "What is the speed of light in vacuum?",
            options: ["3 × 10^6 m/s", "3 × 10^7 m/s", "3 × 10^8 m/s", "3 × 10^9 m/s"],
            correctAnswer: 2
          }
        ]
      },
      'Chemistry': {
        questions: [
          {
            question: "What is the chemical symbol for water?",
            options: ["H2", "O2", "H2O", "CO2"],
            correctAnswer: 2
          },
          {
            question: "What is the pH of pure water?",
            options: ["0", "7", "14", "1"],
            correctAnswer: 1
          }
        ]
      },
      'ICT': {
        questions: [
          {
            question: "What does HTML stand for?",
            options: ["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink and Text Markup Language"],
            correctAnswer: 0
          },
          {
            question: "What is binary code?",
            options: ["Code with two variables", "Code using 0s and 1s", "Code for computers", "Code for websites"],
            correctAnswer: 1
          }
        ]
      }
    };

    const subjectData = quizData[subject] || quizData['Mathematics'];

    // Return 3-5 random questions
    const shuffled = [...subjectData.questions].sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, Math.min(5, shuffled.length));

    return {
      questions: selectedQuestions
    };
  },

  async getSessionFeedback(subject: string, studentLevel: string) {
    // Mock session feedback
    const feedbackOptions = [
      "Keep practicing your fundamentals and focus on problem-solving.",
      "Great progress! Try to work on more complex problems to advance further.",
      "You're doing well! Focus on understanding concepts rather than memorization.",
      "Excellent work! Consider exploring advanced topics in this subject."
    ];

    return feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)];
  }
};
