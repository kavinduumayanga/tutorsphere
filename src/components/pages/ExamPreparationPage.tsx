import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Loader2,
  RefreshCcw,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import {
  apiService,
  type ExamPreparationDifficulty,
  type ExamPreparationImprovementResponse,
  type ExamPreparationOptionLabel,
  type ExamPreparationQuestionCount,
  type ExamPreparationSetResponse,
} from '../../services/apiService';

type ExamPreparationPageProps = {
  onBack: () => void;
};

type ExamPreparationConfig = {
  subject: string;
  topic: string;
  difficulty: ExamPreparationDifficulty;
  questionCount: ExamPreparationQuestionCount;
};

type AnswerRecord = {
  questionId: string;
  selectedOption: ExamPreparationOptionLabel;
  isCorrect: boolean;
  concept: string;
};

const DIFFICULTY_OPTIONS: Array<{ label: string; value: ExamPreparationDifficulty }> = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
];

const QUESTION_COUNT_OPTIONS: ExamPreparationQuestionCount[] = [5, 10, 15];

const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

const buildFallbackTips = (weakAreas: string[]): string[] => {
  if (weakAreas.length === 0) {
    return [
      'Increase challenge by practicing a timed set at a higher difficulty.',
      'Review each explanation and write one takeaway before your next attempt.',
      'Mix questions from related topics to strengthen transfer of knowledge.',
    ];
  }

  return weakAreas.map((area) => `Revise ${area}, then solve 5 focused exam-style MCQs from that area.`);
};

export const ExamPreparationPage: React.FC<ExamPreparationPageProps> = ({ onBack }) => {
  const [config, setConfig] = useState<ExamPreparationConfig>({
    subject: '',
    topic: '',
    difficulty: 'medium',
    questionCount: 10,
  });

  const [questionSet, setQuestionSet] = useState<ExamPreparationSetResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<ExamPreparationOptionLabel | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<{
    isCorrect: boolean;
    correctOption: ExamPreparationOptionLabel;
    explanation: string;
  } | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const [isGeneratingSet, setIsGeneratingSet] = useState(false);
  const [isFetchingTips, setIsFetchingTips] = useState(false);
  const [setError, setSetError] = useState<string | null>(null);
  const [tipsError, setTipsError] = useState<string | null>(null);
  const [improvementTips, setImprovementTips] = useState<ExamPreparationImprovementResponse | null>(null);

  const currentQuestion = questionSet?.questions[currentQuestionIndex] || null;
  const totalQuestions = questionSet?.questions.length || 0;

  const weakAreaStats = useMemo(() => {
    const counts = new Map<string, number>();

    for (const answer of answers) {
      if (answer.isCorrect) {
        continue;
      }

      const key = answer.concept || 'General Concept';
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([concept, count]) => ({ concept, count }))
      .sort((a, b) => b.count - a.count);
  }, [answers]);

  const weakAreaLabels = useMemo(
    () => weakAreaStats.map((entry) => entry.concept),
    [weakAreaStats]
  );

  const score = useMemo(() => answers.filter((entry) => entry.isCorrect).length, [answers]);

  const scorePercent = useMemo(() => {
    if (!totalQuestions) {
      return 0;
    }

    return Math.round((score / totalQuestions) * 100);
  }, [score, totalQuestions]);

  const progressPercent = useMemo(() => {
    if (!totalQuestions) {
      return 0;
    }

    if (showSummary) {
      return 100;
    }

    const completedSoFar = currentQuestionIndex + (currentFeedback ? 1 : 0);
    return Math.round((completedSoFar / totalQuestions) * 100);
  }, [currentFeedback, currentQuestionIndex, showSummary, totalQuestions]);

  const displayWeakAreas =
    improvementTips?.weakAreas?.length
      ? improvementTips.weakAreas
      : weakAreaLabels;

  const displayTips =
    improvementTips?.improvementTips?.length
      ? improvementTips.improvementTips
      : buildFallbackTips(displayWeakAreas);

  const resetAttempt = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setCurrentFeedback(null);
    setAnswers([]);
    setShowSummary(false);
    setSetError(null);
    setTipsError(null);
    setImprovementTips(null);
  };

  const generateQuestionSet = async () => {
    if (!config.subject.trim() || !config.topic.trim()) {
      setSetError('Please provide both subject and topic to generate your exam practice set.');
      return;
    }

    setIsGeneratingSet(true);
    setSetError(null);

    try {
      const generated = await apiService.generateExamPreparationSet({
        subject: config.subject.trim(),
        topic: config.topic.trim(),
        difficulty: config.difficulty,
        questionCount: config.questionCount,
      });

      setQuestionSet(generated);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      setCurrentFeedback(null);
      setAnswers([]);
      setShowSummary(false);
      setTipsError(null);
      setImprovementTips(null);
    } catch (error) {
      setSetError(getErrorMessage(error, 'Unable to generate exam preparation questions right now.'));
    } finally {
      setIsGeneratingSet(false);
    }
  };

  const fetchImprovementTips = async (nextScore: number, nextWeakAreas: string[], nextTotalQuestions: number) => {
    if (isFetchingTips) {
      return;
    }

    setIsFetchingTips(true);
    setTipsError(null);

    try {
      const tips = await apiService.getExamPreparationImprovementTips({
        subject: config.subject.trim(),
        topic: config.topic.trim(),
        difficulty: config.difficulty,
        score: nextScore,
        totalQuestions: nextTotalQuestions,
        weakAreas: nextWeakAreas,
      });

      setImprovementTips(tips);
    } catch (error) {
      setTipsError(getErrorMessage(error, 'Unable to fetch AI improvement tips. Showing fallback guidance.'));
      setImprovementTips(null);
    } finally {
      setIsFetchingTips(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || !selectedOption || currentFeedback) {
      return;
    }

    const isCorrect = selectedOption === currentQuestion.correctOption;

    const nextRecord: AnswerRecord = {
      questionId: currentQuestion.id,
      selectedOption,
      isCorrect,
      concept: currentQuestion.concept,
    };

    setCurrentFeedback({
      isCorrect,
      correctOption: currentQuestion.correctOption,
      explanation: currentQuestion.explanation,
    });

    setAnswers((previous) => {
      const updated = [...previous];
      updated[currentQuestionIndex] = nextRecord;
      return updated;
    });
  };

  const handleContinue = async () => {
    if (!questionSet) {
      return;
    }

    const isLastQuestion = currentQuestionIndex === questionSet.questions.length - 1;

    if (!isLastQuestion) {
      setCurrentQuestionIndex((previous) => previous + 1);
      setSelectedOption(null);
      setCurrentFeedback(null);
      return;
    }

    const finalizedAnswers = answers.filter(Boolean);
    const finalizedScore = finalizedAnswers.filter((entry) => entry.isCorrect).length;

    const counts = new Map<string, number>();
    for (const answer of finalizedAnswers) {
      if (answer.isCorrect) {
        continue;
      }

      counts.set(answer.concept, (counts.get(answer.concept) || 0) + 1);
    }

    const finalizedWeakAreas = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([concept]) => concept);

    setShowSummary(true);
    await fetchImprovementTips(finalizedScore, finalizedWeakAreas, questionSet.questions.length);
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden px-2 py-2 sm:px-4 lg:px-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl shadow-slate-900/[0.06] sm:rounded-[1.75rem]">
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex-none border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-lg sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onBack}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-sm"
                    title="Back to AI tools"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 to-rose-600 shadow-sm">
                    <Target className="h-4 w-4 text-white" />
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Exam Preparation AI</h2>
                    <p className="text-[11px] font-medium text-slate-400 sm:text-xs">
                      Practice mode with instant feedback and exam-focused improvement guidance
                    </p>
                  </div>
                </div>

                {questionSet && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                      onClick={resetAttempt}
                      disabled={answers.length === 0 && !showSummary}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Try Again
                    </button>

                    <button
                      onClick={() => void generateQuestionSet()}
                      disabled={isGeneratingSet}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-fuchsia-700 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingSet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Generate New Set
                    </button>
                  </div>
                )}
              </div>

              {questionSet && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>{showSummary ? 'Completed' : `Question ${Math.min(currentQuestionIndex + 1, totalQuestions)}/${totalQuestions}`}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={false}
                      animate={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                      transition={{ type: 'spring', stiffness: 140, damping: 24 }}
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-rose-600"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex-1 overflow-y-auto custom-scrollbar ai-home-bg px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-4xl">
                <AnimatePresence mode="wait" initial={false}>
                  {!questionSet && (
                    <motion.section
                      key="exam-setup"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="space-y-6"
                    >
                      <div className="rounded-2xl border border-fuchsia-100 bg-white/95 p-6 shadow-sm sm:p-8">
                        <div className="mb-6 flex items-center gap-3">
                          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-rose-600 shadow-lg">
                            <Brain className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Create Your Practice Set</h3>
                            <p className="text-sm font-medium text-slate-500">
                              Practice exam-style questions and improve your performance with instant feedback.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Subject</span>
                            <input
                              value={config.subject}
                              onChange={(event) => setConfig((prev) => ({ ...prev, subject: event.target.value }))}
                              placeholder="e.g. Mathematics"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                            />
                          </label>

                          <label className="space-y-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Topic</span>
                            <input
                              value={config.topic}
                              onChange={(event) => setConfig((prev) => ({ ...prev, topic: event.target.value }))}
                              placeholder="e.g. Quadratic Equations"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-100"
                            />
                          </label>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Difficulty</p>
                            <div className="flex flex-wrap gap-2">
                              {DIFFICULTY_OPTIONS.map((entry) => (
                                <button
                                  key={entry.value}
                                  onClick={() => setConfig((prev) => ({ ...prev, difficulty: entry.value }))}
                                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                                    config.difficulty === entry.value
                                      ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-fuchsia-200 hover:text-fuchsia-600'
                                  }`}
                                >
                                  {entry.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Number Of Questions</p>
                            <div className="flex flex-wrap gap-2">
                              {QUESTION_COUNT_OPTIONS.map((count) => (
                                <button
                                  key={count}
                                  onClick={() => setConfig((prev) => ({ ...prev, questionCount: count }))}
                                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                                    config.questionCount === count
                                      ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-fuchsia-200 hover:text-fuchsia-600'
                                  }`}
                                >
                                  {count}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {setError && (
                          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                            {setError}
                          </div>
                        )}

                        <div className="mt-6 flex items-center justify-end">
                          <button
                            onClick={() => void generateQuestionSet()}
                            disabled={isGeneratingSet}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-200 transition-all hover:from-fuchsia-700 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-65"
                          >
                            {isGeneratingSet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {isGeneratingSet ? 'AI is generating your exam set...' : 'Generate Exam Set'}
                          </button>
                        </div>
                      </div>
                    </motion.section>
                  )}

                  {questionSet && !showSummary && currentQuestion && (
                    <motion.section
                      key="exam-question"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="space-y-5"
                    >
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-700">
                            <Target className="h-3.5 w-3.5" />
                            {questionSet.setTitle}
                          </div>
                          <div className="text-xs font-semibold text-slate-500">Question {currentQuestionIndex + 1}/{totalQuestions}</div>
                        </div>

                        <p className="text-lg font-bold leading-relaxed text-slate-900">{currentQuestion.question}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500">Focus area: {currentQuestion.concept}</p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {(Object.entries(currentQuestion.options) as Array<[ExamPreparationOptionLabel, string]>).map(([label, text]) => {
                            const isPicked = selectedOption === label;
                            const showCorrect = Boolean(currentFeedback) && currentFeedback.correctOption === label;
                            const showIncorrectSelection = Boolean(currentFeedback) && isPicked && !currentFeedback.isCorrect;

                            return (
                              <button
                                key={label}
                                onClick={() => {
                                  if (!currentFeedback) {
                                    setSelectedOption(label);
                                  }
                                }}
                                disabled={Boolean(currentFeedback)}
                                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
                                  showCorrect
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                    : showIncorrectSelection
                                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                                      : isPicked
                                        ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-fuchsia-200 hover:bg-fuchsia-50/40'
                                }`}
                              >
                                <span className="mr-2 text-xs font-black">{label}.</span>
                                {text}
                              </button>
                            );
                          })}
                        </div>

                        {currentFeedback && (
                          <div className={`mt-5 rounded-xl border px-4 py-3 ${
                            currentFeedback.isCorrect
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-rose-200 bg-rose-50 text-rose-800'
                          }`}>
                            <div className="flex items-center gap-2 text-sm font-bold">
                              {currentFeedback.isCorrect ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                              {currentFeedback.isCorrect
                                ? 'Correct answer!'
                                : `Incorrect. Correct option: ${currentFeedback.correctOption}`}
                            </div>
                            <p className="mt-1.5 text-sm font-medium leading-relaxed">{currentFeedback.explanation}</p>
                          </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                          {!currentFeedback && (
                            <button
                              onClick={handleSubmitAnswer}
                              disabled={!selectedOption}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:from-fuchsia-700 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Submit Answer
                            </button>
                          )}

                          {currentFeedback && (
                            <button
                              onClick={() => void handleContinue()}
                              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:from-fuchsia-700 hover:to-rose-700"
                            >
                              {currentQuestionIndex === totalQuestions - 1 ? 'View Summary' : 'Next Question'}
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.section>
                  )}

                  {questionSet && showSummary && (
                    <motion.section
                      key="exam-summary"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="space-y-5"
                    >
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-xl font-extrabold tracking-tight text-slate-900">Score Summary</h3>
                          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-700">
                            <Target className="h-3.5 w-3.5" />
                            {score}/{totalQuestions} ({scorePercent}%)
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Weak Areas</p>
                            <div className="mt-2 space-y-2">
                              {displayWeakAreas.length === 0 && (
                                <p className="text-sm font-semibold text-emerald-700">No major weak areas detected in this attempt.</p>
                              )}

                              {displayWeakAreas.map((area) => {
                                const count = weakAreaStats.find((entry) => entry.concept === area)?.count;
                                return (
                                  <div key={area} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                                    <span>{area}</span>
                                    {count ? <span className="text-xs font-bold text-rose-600">{count} miss{count > 1 ? 'es' : ''}</span> : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Improvement Tips</p>

                            {isFetchingTips && (
                              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                AI is preparing personalized tips...
                              </div>
                            )}

                            {tipsError && (
                              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                                {tipsError}
                              </p>
                            )}

                            <ul className="mt-3 space-y-2">
                              {displayTips.map((tip) => (
                                <li key={tip} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {(improvementTips?.encouragement || improvementTips?.nextPracticePlan) && (
                          <div className="mt-4 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4">
                            {improvementTips?.encouragement && (
                              <p className="text-sm font-semibold text-fuchsia-800">{improvementTips.encouragement}</p>
                            )}
                            {improvementTips?.nextPracticePlan && (
                              <p className="mt-1.5 text-sm font-medium text-fuchsia-700">
                                Next plan: {improvementTips.nextPracticePlan}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
                          <button
                            onClick={resetAttempt}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-indigo-200 hover:text-indigo-600"
                          >
                            <RefreshCcw className="h-4 w-4" />
                            Try Again
                          </button>

                          <button
                            onClick={() => void generateQuestionSet()}
                            disabled={isGeneratingSet}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:from-fuchsia-700 hover:to-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isGeneratingSet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Generate New Set
                          </button>
                        </div>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
