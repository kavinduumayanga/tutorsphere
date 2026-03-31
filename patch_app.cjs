const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');

const injectionPoint = `        {/* About Page */}
        {activeTab === 'about' && (`;

const newCode = `        {/* Manage Availability Page */}
        {activeTab === 'manageAvailability' && isTutor && currentUser && (
          <TutorAvailabilityManagePage 
            tutor={tutors.find(t => t.id === currentUser.id)!} 
            onBack={() => setActiveTab('dashboard')} 
          />
        )}

        {/* About Page */}
        {activeTab === 'about' && (`;

const updatedContent = content.replace(injectionPoint, newCode);

fs.writeFileSync('src/App.tsx', updatedContent);
