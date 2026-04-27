import { sanitizeUserInput } from '../faq-chatbot/security.js';
import { azureOpenAiClient } from '../quiz-chatbot/azureOpenAiClient.js';
import {
  buildTutorRevenueInsightsUserPrompt,
  TUTOR_REVENUE_INSIGHTS_ASSISTANT_NAME,
  TUTOR_REVENUE_INSIGHTS_SYSTEM_PROMPT,
} from './promptRules.js';

export type TutorRevenueInsightsAiInput = {
  tutorName: string;
  currentHourlyRate: number;
  forecast: {
    windows: Array<{
      days: number;
      projectedNetEarning: number;
      historicalProjection: number;
      upcomingConfirmedNet: number;
      confidence: 'low' | 'medium' | 'high';
    }>;
    fallback: boolean;
    fallbackMessage?: string;
  };
  pricing: {
    currentHourlyRate: number;
    suggestedHourlyRate: number;
    suggestedRange: { min: number; max: number };
    direction: 'increase' | 'decrease' | 'keep';
    confidence: 'low' | 'medium' | 'high';
    reason: string;
    metrics: {
      bookingDemandLast30Days: number;
      completedSessions: number;
      cancelledSessions: number;
      cancellationRate: number;
      completionRate: number;
      conversionRate: number;
      averageRating: number;
      totalReviewCount: number;
    };
  };
  tax: {
    latestMonth: string;
    latestNetTaxableIncome: number;
    totalSessionIncome: number;
    totalCourseSales: number;
    totalPlatformFees: number;
    totalRefunds: number;
    totalWithdrawals: number;
  };
};

export type TutorRevenueInsightsAiOutput = {
  assistant: string;
  source: 'azure' | 'fallback';
  forecastSummary: string;
  pricingSummary: string;
  taxSummary: string;
  actionItems: string[];
  warning?: string;
};

const toSafeText = (value: unknown, fallback: string, maxLength = 500): string => {
  const normalized = sanitizeUserInput(String(value || '')).trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maxLength);
};

const tryParseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through.
  }

  return null;
};

const extractJsonObject = (rawReply: string): Record<string, unknown> => {
  const direct = tryParseJsonObject(rawReply);
  if (direct) {
    return direct;
  }

  const fenced = rawReply.match(/```json\s*([\s\S]*?)```/i) || rawReply.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = tryParseJsonObject(fenced[1]);
    if (fromFence) {
      return fromFence;
    }
  }

  const startIndex = rawReply.indexOf('{');
  const endIndex = rawReply.lastIndexOf('}');
  if (startIndex >= 0 && endIndex > startIndex) {
    const candidate = rawReply.slice(startIndex, endIndex + 1);
    const extracted = tryParseJsonObject(candidate);
    if (extracted) {
      return extracted;
    }
  }

  throw new Error('Tutor Revenue Insights AI returned invalid JSON content.');
};

const buildFallbackInsights = (
  input: TutorRevenueInsightsAiInput,
  warning?: string
): TutorRevenueInsightsAiOutput => {
  const topForecast = input.forecast.windows[0];
  const forecastSummary = input.forecast.fallback
    ? `Forecast is conservative due to limited history. Current estimate for the next ${topForecast?.days || 30} days is based mostly on confirmed upcoming sessions and recent performance.`
    : `Forecast combines historical net earnings and confirmed upcoming sessions. The next ${topForecast?.days || 30}-day projection is LKR ${Number(topForecast?.projectedNetEarning || 0).toFixed(2)} with ${topForecast?.confidence || 'medium'} confidence.`;

  const pricingSummary = `Current hourly rate is LKR ${input.currentHourlyRate.toFixed(2)}. Suggested direction is to ${input.pricing.direction} toward LKR ${input.pricing.suggestedHourlyRate.toFixed(2)} (${input.pricing.confidence} confidence) based on demand, completion, cancellations, and rating trends.`;

  const taxSummary = `Tax prep summary tracks session income, course sales, platform fees, refunds, and withdrawals. Latest monthly net taxable estimate is LKR ${input.tax.latestNetTaxableIncome.toFixed(2)}.`;

  const actionItems = [
    'Review cancellations weekly and reduce avoidable schedule conflicts.',
    'Revisit your hourly rate after every 10 completed sessions.',
    'Export the CSV report monthly for accounting and tax filing records.',
  ];

  return {
    assistant: TUTOR_REVENUE_INSIGHTS_ASSISTANT_NAME,
    source: 'fallback',
    forecastSummary,
    pricingSummary,
    taxSummary,
    actionItems,
    warning,
  };
};

const FALLBACK_AI_WARNING =
  'AI insights are temporarily unavailable. Showing reliable fallback guidance from your live revenue data.';

const MISSING_AZURE_CONFIG_WARNING =
  'AI insights are unavailable because Azure AI is not fully configured on the server. Showing fallback guidance from live revenue data.';

const REQUIRED_AZURE_ENV_VARS = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_DEPLOYMENT',
  'AZURE_OPENAI_API_VERSION',
] as const;

const DEFAULT_FORECAST_SUMMARY =
  'Forecast is generated from your historical and upcoming confirmed bookings.';
const DEFAULT_PRICING_SUMMARY =
  'Pricing recommendation is based on demand, completion rate, and session outcomes.';
const DEFAULT_TAX_SUMMARY =
  'Tax summary groups your revenue and payout movements into monthly accounting categories.';

const sanitizeErrorMessage = (error: unknown): string => {
  const fallback = 'Unknown AI integration error.';
  if (!(error instanceof Error)) {
    return fallback;
  }

  const normalized = sanitizeUserInput(error.message || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 400);
};

const getMissingAzureConfigVars = (): string[] => {
  return REQUIRED_AZURE_ENV_VARS.filter((envKey) => {
    const value = String(process.env[envKey] || '').trim();
    return !value;
  });
};

const logRevenueAiIssue = (stage: string, error: unknown): void => {
  console.error('[TutorRevenueAI] Stage failed', {
    stage,
    error: sanitizeErrorMessage(error),
  });
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const resolveSectionValue = (
  payload: Record<string, unknown>,
  primaryKey: string,
  legacyKey: string,
  fallbackValue: string
): { text: string; hasExplicitValue: boolean } => {
  const primaryValue = payload[primaryKey];
  if (typeof primaryValue === 'string') {
    const normalized = toSafeText(primaryValue, '', 520);
    return {
      text: normalized || fallbackValue,
      hasExplicitValue: Boolean(normalized),
    };
  }

  const primaryObject = asRecord(primaryValue);
  const nestedCandidate = primaryObject.summary ?? primaryObject.text ?? primaryObject.overview;
  if (typeof nestedCandidate === 'string') {
    const normalized = toSafeText(nestedCandidate, '', 520);
    return {
      text: normalized || fallbackValue,
      hasExplicitValue: Boolean(normalized),
    };
  }

  const legacyNormalized = toSafeText(payload[legacyKey], '', 520);
  return {
    text: legacyNormalized || fallbackValue,
    hasExplicitValue: Boolean(legacyNormalized),
  };
};

const resolveRecommendedActions = (payload: Record<string, unknown>): string[] => {
  const primaryActions = Array.isArray(payload.recommendedActions)
    ? payload.recommendedActions
    : Array.isArray(payload.actionItems)
      ? payload.actionItems
      : [];

  return primaryActions
    .map((item) => toSafeText(item, '', 180))
    .filter(Boolean)
    .slice(0, 5);
};

const normalizeInsightsPayload = (
  parsedPayload: Record<string, unknown>,
  input: TutorRevenueInsightsAiInput
): Omit<TutorRevenueInsightsAiOutput, 'assistant' | 'source' | 'warning'> => {
  const forecast = resolveSectionValue(parsedPayload, 'forecast', 'forecastSummary', DEFAULT_FORECAST_SUMMARY);
  const pricing = resolveSectionValue(parsedPayload, 'pricing', 'pricingSummary', DEFAULT_PRICING_SUMMARY);
  const tax = resolveSectionValue(parsedPayload, 'taxPrep', 'taxSummary', DEFAULT_TAX_SUMMARY);
  const actionItems = resolveRecommendedActions(parsedPayload);

  const missingFields: string[] = [];
  if (!forecast.hasExplicitValue) {
    missingFields.push('forecast');
  }
  if (!pricing.hasExplicitValue) {
    missingFields.push('pricing');
  }
  if (!tax.hasExplicitValue) {
    missingFields.push('taxPrep');
  }
  if (actionItems.length === 0) {
    missingFields.push('recommendedActions');
  }

  if (missingFields.length > 0) {
    throw new Error(`Invalid AI response format. Missing or empty fields: ${missingFields.join(', ')}`);
  }

  return {
    forecastSummary: forecast.text,
    pricingSummary: pricing.text,
    taxSummary: tax.text,
    actionItems: actionItems.length > 0 ? actionItems : buildFallbackInsights(input).actionItems,
  };
};

const requestAzureInsights = async (
  input: TutorRevenueInsightsAiInput,
  options: { jsonResponse: boolean; attemptLabel: string }
): Promise<Omit<TutorRevenueInsightsAiOutput, 'assistant' | 'source' | 'warning'>> => {
  const userPrompt = buildTutorRevenueInsightsUserPrompt(input as unknown as Record<string, unknown>);
  const rawReply = await azureOpenAiClient.chat(
    [
      {
        role: 'system',
        content: TUTOR_REVENUE_INSIGHTS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    {
      temperature: 0.2,
      maxTokens: 900,
      jsonResponse: options.jsonResponse,
    }
  );

  const parsed = extractJsonObject(rawReply);

  try {
    return normalizeInsightsPayload(parsed, input);
  } catch (error) {
    logRevenueAiIssue(`${options.attemptLabel}:contract-validation`, error);
    throw error;
  }
};

export class TutorRevenueInsightsAiService {
  async generateInsights(input: TutorRevenueInsightsAiInput): Promise<TutorRevenueInsightsAiOutput> {
    const missingEnvKeys = getMissingAzureConfigVars();
    if (missingEnvKeys.length > 0) {
      console.warn('[TutorRevenueAI] Missing required Azure OpenAI environment variables', {
        missingEnvKeys,
      });
      return buildFallbackInsights(input, MISSING_AZURE_CONFIG_WARNING);
    }

    try {
      const normalizedInsights = await requestAzureInsights(input, {
        jsonResponse: true,
        attemptLabel: 'primary-json-mode',
      });

      return {
        assistant: TUTOR_REVENUE_INSIGHTS_ASSISTANT_NAME,
        source: 'azure',
        ...normalizedInsights,
      };
    } catch (primaryError) {
      logRevenueAiIssue('primary-json-mode:azure-call', primaryError);
    }

    try {
      const normalizedInsights = await requestAzureInsights(input, {
        jsonResponse: false,
        attemptLabel: 'secondary-text-mode',
      });

      return {
        assistant: TUTOR_REVENUE_INSIGHTS_ASSISTANT_NAME,
        source: 'azure',
        ...normalizedInsights,
      };
    } catch (secondaryError) {
      logRevenueAiIssue('secondary-text-mode:azure-call', secondaryError);
    }

    return buildFallbackInsights(input, FALLBACK_AI_WARNING);
  }
}

export const tutorRevenueInsightsAiService = new TutorRevenueInsightsAiService();
