const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /{ \/\* Manage Availability Page \*\/\s*{activeTab === 'manageAvailability'[\s\S]*?<TutorAvailabilityManagePage[\s\S]*?\/>\s*)}\s*{ \/\* Manage Availability Page \*\/\s*{activeTab === 'manageAvailability'[\s\S]*?<TutorAvailabilityManagePage[\s\S]*?\/>\s*)}/g;

content = content.replace(regex, `        {/* Manage Availability Page */}
        {activeTab === 'manageAvailability' && isTutor && currentUser && (
          <TutorAvailabilityManagePage 
            tutor={tutors.find(t => t.id === currentUser.id)!} 
            onBack={() => setActiveTab('dashboard')} 
          />
        )}`);

fs.writeFileSync('src/App.tsx', content);
