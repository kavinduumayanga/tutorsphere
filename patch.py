import sys
with open('src/App.tsx', 'r') as f: code = f.read()
target = '''        {activeTab === 'register' && !currentUser && (
          <GetStartedSection 
            onAccountCreated={(user) => {
              setCurrentUser(user);
              setActiveTab('dashboard');
              localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
            }} 
            STEM_SUBJECTS={STEM_SUBJECTS}
          />
        )}'''
rep = target + '''

        {activeTab === 'registerSelect' && !currentUser && (
          <RegistrationSelectionPage 
            onSelectRole={(role) => setActiveTab(role === 'student' ? 'registerStudent' : 'registerTutor')} 
    echo  echo     echo  echo     echo  echo     echo  echo     echo  echo    = echo  echo     echo  echo     echo  echo     echo  echo     echo onecho  echo     echo  echo     echo  stecho     echo  echo     echo  echo     echo  lsecho     echo  echo     echo  echo     echtiecho  echo     echo  echo     echo  echo   Acecho  echo     echo  echo     echo  echo     echo  echo     echo  echo     echo  = echseecho     echo  echo     echh.echo  echo     echo  echo     echo  echo    .secho  echo     echo  asecho     echo  echo     e echo     echo  echo     echo  echo     echo  CTecho     echo  echo     echo  echo     echo  echo     echo   echo  echo     echoatch.py
echo  {activeTab echo         {activeTab echo  {activeTab echo         {activeTab echo  {activeTab echo         {activeTab eialRole="tutor"
            showRoleSelector={false}
            onBack={() => setActiveTab('registerSelect')}
            onAccountCreated={(user) => {
              setCurrentUser(user);
              setActiveTab('dashboard');
              localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
            }} 
            STEM_SUBJECTS={STEM_SUBJECTS}
          />
        )}'''
if target in code:
    with open('src/App.tsx', 'w') as f: f.write(code.replace(target, rep))
    print('Success')
else: print('Failed')
