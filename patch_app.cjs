const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add import
if (!code.includes("RegistrationSelectionPage")) {
   code = code.replace("const STEM_SUBJECTS =", "import { RegistrationSelectionPage } from './components/pages/RegistrationSelectionPage';\n\nconst STEM_SUBJECTS =");
}

// 2. Add Tabs mapping 
code = code.replace(
"type Tab = 'home' | 'tutors' | 'questions' | 'courses' | 'resources' | 'quizzes' | 'register' | 'dashboard' | 'settings' | 'tutorProfile' | 'tutorBooking';",
"type Tab = 'home' | 'tutors' | 'questions' | 'courses' | 'resources' | 'quizzes' | 'register' | 'dashboard' | 'settings' | 'tutorProfile' | 'tutorBooking' | 'registerSelect' | 'registerStudent' | 'registerTutor';"
);

code = code.replace(
"  tutorBooking: 'Book Session'\n};",
"  tutorBooking: 'Book Session',\n  registerSelect: 'Get Started',\n  registerStudent: 'Student Registration',\n  registerTutor: 'Tutor Registration'\n};"
);

// 3. Add to Allowed modes
code = code.replace(
"['home', 'tutors', 'courses', 'resources', 'register', 'tutorProfile', 'tutorBooking'];",
"['home', 'tutors', 'courses', 'resources', 'register', 'tutorProfile', 'tutorBooking', 'registerSelect', 'registerStudent', 'registerTutor'];"
);

// 4. Component Injection
const searchStr = `        {activeTab === 'register' && !currentUser && (
          <GetStartedSection 
            onAccountCreated={(user) => {
              setCurrentUser(user);
              setActiveTab('dashboard');
              localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
            }} 
            STEM_SUBJECTS={STEM_SUBJECTS}
          />
        )}`;

const addStr = `

        {activeTab === 'registerSelect' && !currentUser && (
          <RegistrationSelectionPage 
            onSelectRole={(role) => setActiveTab(role === 'student' ? 'registerStudent' : 'registerTutor')} 
          />
        )}

        {activeTab === 'registerStudent' && !currentUser && (
          <GetStartedSection 
             initialRole="student"
            showRoleSelector={false}
            onBack={() => setActiveTab('registerSelect')}
            onAccountCreated={(user) => {
              setCurrentUser(user);
              setActiveTab('dashboard');
              localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
            }} 
            STEM_SUBJECTS={STEM_SUBJECTS}
          />
        )}

        {activeTab === 'registerTutor' && !currentUser && (
          <GetStartedSection 
             initialRole="tutor"
            showRoleSelector={false}
            onBack={() => setActiveTab('registerSelect')}
            onAccountCreated={(user) => {
              setCurrentUser(user);
              setActiveTab('dashboard');
              localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
            }} 
            STEM_SUBJECTS={STEM_SUBJECTS}
          />
        )}`;

if (code.includes(searchStr)) {
    code = code.replace(searchStr, searchStr + addStr);
}

// 5. Replace "Get Started" prompt in bottom popup
code = code.replace("onClick={() => { setShowAuthModal(false); setActiveTab('register'); }}", "onClick={() => { setShowAuthModal(false); setActiveTab('registerSelect'); }}");

// 6. Fix "Become a Tutor" links
code = code.replace("onClick={() => setActiveTab('register')}", "onClick={() => setActiveTab('registerSelect')}");
code = code.replace("onClick={() => setActiveTab('register')}", "onClick={() => setActiveTab('registerSelect')}");
code = code.replace("onClick={() => setActiveTab('register')}", "onClick={() => setActiveTab('registerSelect')}");

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx successfully");
