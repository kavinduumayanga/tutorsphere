export const ALLOWED_TUTOR_SUBJECTS = ['Maths', 'Science', 'Engineering', 'Tech', 'ICT'] as const;

export type AllowedTutorSubject = (typeof ALLOWED_TUTOR_SUBJECTS)[number];

const SUBJECT_ALIAS_MAP: Record<string, AllowedTutorSubject> = {
  maths: 'Maths',
  mathematics: 'Maths',
  science: 'Science',
  engineering: 'Engineering',
  tech: 'Tech',
  technology: 'Tech',
  ict: 'ICT',
};

export const normalizeTutorSubject = (value: unknown): AllowedTutorSubject | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return SUBJECT_ALIAS_MAP[normalized] || null;
};

export const normalizeTutorSubjects = (subjects: unknown): AllowedTutorSubject[] => {
  if (!Array.isArray(subjects)) {
    return [];
  }

  const uniqueSubjects = new Set<AllowedTutorSubject>();

  for (const rawSubject of subjects) {
    const normalizedSubject = normalizeTutorSubject(rawSubject);
    if (normalizedSubject) {
      uniqueSubjects.add(normalizedSubject);
    }
  }

  return Array.from(uniqueSubjects);
};