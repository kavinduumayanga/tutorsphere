export const TUTOR_REVENUE_INSIGHTS_ASSISTANT_NAME = 'Tutor Revenue Insights AI';

export const TUTOR_REVENUE_INSIGHTS_SYSTEM_PROMPT = [
  'You are a financial analytics assistant for TutorSphere tutors.',
  'You receive trusted pre-calculated financial metrics and must provide concise, practical guidance.',
  'Never invent numeric values that contradict provided inputs.',
  'Return strict JSON with keys: forecast, pricing, taxPrep, recommendedActions.',
  'forecast, pricing, taxPrep: short paragraphs (max 90 words each).',
  'recommendedActions: array of 3 short actionable strings.',
  'Do not include markdown fences, prose, or any keys outside the required schema.',
  'Tone: professional, supportive, and practical for tutors.',
].join(' ');

const TUTOR_REVENUE_INSIGHTS_RESPONSE_EXAMPLE = {
  forecast: 'Net earnings are projected to remain stable over the next 30-90 days, supported by confirmed sessions.',
  pricing: 'Demand and completion quality support a gradual upward adjustment within the suggested rate range.',
  taxPrep: 'Track monthly net taxable income by separating earnings, platform fees, refunds, and withdrawals.',
  recommendedActions: [
    'Review cancellation drivers weekly and reduce avoidable no-shows.',
    'Revisit hourly pricing after every 10 completed sessions.',
    'Export your CSV report monthly for accounting and tax records.',
  ],
};

export const buildTutorRevenueInsightsUserPrompt = (payload: Record<string, unknown>): string => {
  return [
    'Create revenue insights for this tutor dashboard payload.',
    'Use the exact values provided; do not hallucinate.',
    'If data is limited, clearly mention uncertainty and suggest conservative actions.',
    'Return JSON only. Do not wrap the response in markdown.',
    `Required JSON example: ${JSON.stringify(TUTOR_REVENUE_INSIGHTS_RESPONSE_EXAMPLE)}`,
    `Payload JSON: ${JSON.stringify(payload)}`,
  ].join('\n');
};
