const fs = require('fs');
const filePath = '/Users/kavinduumayanga/Desktop/tutorsphere/src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The exact string to start searching
const startTag = `          {activeTab === 'quizzes' && (!currentUser || isStudent) && (`
// The end string
const endTag = `          {activeTab === 'questions' && (!currentUser || isStudent) && (`

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = content.substring(0, startIndex) +
    `          {activeTab === 'quizzes' && (
            <div className="flex-1 w-full bg-slate-50">
              <QuizChatbotPage />
            </div>
          )}

` +
    content.substring(endIndex);
  
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log("Successfully replaced the quizzes block in App.tsx");
} else {
  console.error("Could not find start or end tags!");
  console.log("Start tag found:", startIndex !== -1);
  console.log("End tag found:", endIndex !== -1);
}
