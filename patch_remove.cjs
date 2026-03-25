const fs = require('fs');
const file = 'src/components/pages/TutorProfilePage.tsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '{/* Weekly Availability Section */}';
const endMarker = '</section>';

const startIndex = content.indexOf(startMarker);
if (startIndex !== -1) {
  const endIndex = content.indexOf(endMarker, startIndex) + endMarker.length;
  
  if (endIndex > startIndex) {
    // Remove it
    content = content.substring(0, startIndex) + content.substring(endIndex);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully removed the weekly availability section');
  } else {
    console.log('Could not find the end of the section');
  }
} else {
  console.log('Could not find the weekly availability section');
}