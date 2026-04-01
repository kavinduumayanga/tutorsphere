with open("src/App.tsx", "r") as f:
    content = f.read()

new_content = content.replace(
    'alert("Schedule manager will be implemented in the next update!")',
    "{\n"
    "                      if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University') {\n"
    "                        setActiveTab('manageAvailability');\n"
    "                      } else {\n"
    "                        alert('Advanced schedule manager is currently available for School level tutors only.');\n"
    "                      }\n"
    "                    }"
)

with open("src/App.tsx", "w") as f:
    f.write(new_content)
