const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

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

const addStr = `\n
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
    fs.writeFileSync('src/App.tsx', code);
    console.log('Success');
} else {
    console.log('Failed');
}
