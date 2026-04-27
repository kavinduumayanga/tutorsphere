/**
 * TutorEarningsPage – Modern SaaS-style Revenue Dashboard
 * Pure UI component. No backend logic changes.
 */
import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BarChart3,
  Brain,
  Calculator,
  CheckCircle,
  Clock,
  TrendingUp,
  Wallet,
  CircleDollarSign,
  ShieldCheck,
  CreditCard,
  Receipt,
  Download,
  FileDown,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { formatLkr } from '../../utils/currency';
import { TutorRevenueInsights } from '../../types';

/* ─── Fade-up animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export interface TutorEarningsPageProps {
  setActiveTab: (tab: string) => void;

  /* withdrawal */
  handleOpenWithdrawalModal: () => void;
  isLoadingWithdrawalData: boolean;
  withdrawalAvailableBalance: number;
  withdrawalTotalEarnings: number;
  withdrawalWithdrawnAmount: number;
  withdrawalPendingAmount: number;
  withdrawalNotice: { type: string; message: string } | null;
  withdrawalRequests: any[];
  getWithdrawalStatusPillClassName: (s: string) => string;
  getWithdrawalStatusLabel: (s: string) => string;
  getWithdrawalPayoutMethodLabel: (s: string) => string;

  /* earnings */
  tutorSessionNetEarnings: number;
  tutorCourseNetEarnings: number;
  tutorCompletedPaidBookings: any[];
  tutorPaidCourseEnrollmentsCount: number;
  tutorHasSessionEarningMethod: boolean;
  tutorHasCourseEarningMethod: boolean;
  tutorSessionSharePercent: number;
  tutorCourseSharePercent: number;
  tutorPaidTransactions: any[];
  tutorPaidSessionTransactions: any[];
  tutorPaidCourseTransactions: any[];
  tutorRecentMonthlyEarnings: any[];
  PLATFORM_FEE_RATE: number;

  /* transaction table */
  filteredTutorTransactions: any[];
  tutorTransactionFilter: string;
  setTutorTransactionFilter: (v: any) => void;
  tutorTransactionSortOrder: string;
  setTutorTransactionSortOrder: (v: any) => void;
  getTransactionStatusPillClassName: (s: string) => string;
  getTransactionStatusLabel: (s: string) => string;
  isLoadingUserData: boolean;
  revenueInsights: TutorRevenueInsights | null;
  isLoadingRevenueInsights: boolean;
  revenueInsightsError: string | null;
  handleDownloadRevenueCsv: () => void;
  isDownloadingRevenueCsv: boolean;
  handleRetryRevenueInsights: () => void;
  handleApplyPricingSuggestion: () => void;
  isApplyingPricingSuggestion: boolean;
  pricingSuggestionApplyState: {
    cycleId: string;
    appliedRate: number;
    message: string;
  } | null;
  currentTutorHourlyRate: number;
}

export const TutorEarningsPage: React.FC<TutorEarningsPageProps> = (props) => {
  const {
    setActiveTab,
    handleOpenWithdrawalModal,
    isLoadingWithdrawalData,
    withdrawalAvailableBalance,
    withdrawalTotalEarnings,
    withdrawalWithdrawnAmount,
    withdrawalPendingAmount,
    withdrawalNotice,
    withdrawalRequests,
    getWithdrawalStatusPillClassName,
    getWithdrawalStatusLabel,
    getWithdrawalPayoutMethodLabel,
    tutorSessionNetEarnings,
    tutorCourseNetEarnings,
    tutorCompletedPaidBookings,
    tutorPaidCourseEnrollmentsCount,
    tutorHasSessionEarningMethod,
    tutorHasCourseEarningMethod,
    tutorSessionSharePercent,
    tutorCourseSharePercent,
    tutorPaidTransactions,
    tutorPaidSessionTransactions,
    tutorPaidCourseTransactions,
    tutorRecentMonthlyEarnings,
    PLATFORM_FEE_RATE,
    filteredTutorTransactions,
    tutorTransactionFilter,
    setTutorTransactionFilter,
    tutorTransactionSortOrder,
    setTutorTransactionSortOrder,
    getTransactionStatusPillClassName,
    getTransactionStatusLabel,
    isLoadingUserData,
    revenueInsights,
    isLoadingRevenueInsights,
    revenueInsightsError,
    handleDownloadRevenueCsv,
    isDownloadingRevenueCsv,
    handleRetryRevenueInsights,
    handleApplyPricingSuggestion,
    isApplyingPricingSuggestion,
    pricingSuggestionApplyState,
    currentTutorHourlyRate,
  } = props;

  /* ─── Top financial cards ─── */
  const insightsSummary = revenueInsights?.summary;
  const insightsForecast = revenueInsights?.forecasting;
  const insightsPricing = revenueInsights?.pricingSuggestion;
  const insightsTax = revenueInsights?.taxPrep;
  const insightsAi = revenueInsights?.aiInsights;
  const shouldShowAiRetry = Boolean(revenueInsightsError) || Boolean(insightsAi?.warning);
  const currentPricingCycleId = String(revenueInsights?.generatedAt || '').trim();
  const isPricingSuggestionApplied = Boolean(
    pricingSuggestionApplyState &&
      currentPricingCycleId &&
      pricingSuggestionApplyState.cycleId === currentPricingCycleId
  );
  const effectiveMonthlyEarnings = (insightsSummary?.monthlyEarnings || tutorRecentMonthlyEarnings || []).slice(-6);
  const paymentHistoryRows = insightsSummary?.paymentHistory?.length
    ? insightsSummary.paymentHistory
    : filteredTutorTransactions;
  const visiblePaymentRows = React.useMemo(() => {
    const statusFiltered = paymentHistoryRows.filter((transaction: any) =>
      tutorTransactionFilter === 'all' ? true : transaction.status === tutorTransactionFilter
    );

    return [...statusFiltered].sort((a: any, b: any) =>
      tutorTransactionSortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );
  }, [paymentHistoryRows, tutorTransactionFilter, tutorTransactionSortOrder]);

  const completedSessionEarnings = insightsSummary?.completedSessionEarnings ?? tutorSessionNetEarnings;
  const pendingEarnings = insightsSummary?.pendingEarnings ?? 0;
  const normalizedCurrentTutorHourlyRate = Number.isFinite(Number(currentTutorHourlyRate))
    ? Math.max(0, Number(currentTutorHourlyRate))
    : 0;
  const displayedCurrentPricingRate =
    normalizedCurrentTutorHourlyRate > 0
      ? normalizedCurrentTutorHourlyRate
      : Number(insightsPricing?.currentHourlyRate || 0);
  const suggestedPricingRate = Number(insightsPricing?.suggestedHourlyRate || 0);
  const isSuggestedRateAlreadyCurrent =
    displayedCurrentPricingRate > 0 &&
    suggestedPricingRate > 0 &&
    Math.abs(displayedCurrentPricingRate - suggestedPricingRate) < 0.01;

  const financialCards = [
    { label: 'Total Net Earnings', value: formatLkr(withdrawalTotalEarnings), color: 'text-slate-900', bg: 'bg-gradient-to-br from-slate-50 to-slate-100/60', iconBg: 'bg-slate-200/60', icon: CircleDollarSign, border: 'border-slate-200/80' },
    { label: 'Withdrawn', value: formatLkr(withdrawalWithdrawnAmount), color: 'text-emerald-700', bg: 'bg-gradient-to-br from-emerald-50/80 to-emerald-100/40', iconBg: 'bg-emerald-100', icon: Download, border: 'border-emerald-200/60' },
    { label: 'Pending Withdrawals', value: formatLkr(withdrawalPendingAmount), color: 'text-amber-700', bg: 'bg-gradient-to-br from-amber-50/80 to-amber-100/40', iconBg: 'bg-amber-100', icon: Clock, border: 'border-amber-200/60' },
    { label: 'Available Balance', value: formatLkr(withdrawalAvailableBalance), color: 'text-emerald-600', bg: 'bg-gradient-to-br from-emerald-50/60 to-teal-100/30', iconBg: 'bg-emerald-100/80', icon: Wallet, border: 'border-emerald-200/60' },
  ];

  const detailCards = [
    { label: 'Completed Session Earnings', value: formatLkr(completedSessionEarnings), color: 'text-indigo-700', icon: Activity },
    { label: 'Pending Earnings', value: formatLkr(pendingEarnings), color: 'text-amber-700', icon: Clock },
    { label: 'Completed Sessions', value: tutorCompletedPaidBookings.length, color: 'text-emerald-600', icon: ShieldCheck },
    { label: 'Paid Course Sales', value: tutorPaidCourseEnrollmentsCount, color: 'text-cyan-600', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">

      {/* ──── Header ──── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/70 shadow-sm p-6 md:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 w-60 h-60 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 w-44 h-44 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 opacity-40 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tutor Revenue Dashboard
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm">
              Production-style payout analytics from paid/completed sessions and course purchases.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {tutorHasSessionEarningMethod && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
                  Session Revenue
                </span>
              )}
              {tutorHasCourseEarningMethod && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700">
                  Course Revenue
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                Course payouts include {(PLATFORM_FEE_RATE * 100).toFixed(0)}% platform fee
              </span>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </button>
              <button
                type="button"
                onClick={handleDownloadRevenueCsv}
                disabled={isDownloadingRevenueCsv}
                className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] ${
                  isDownloadingRevenueCsv
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-200/60'
                }`}
              >
                <FileDown className="w-4 h-4" />
                {isDownloadingRevenueCsv ? 'Preparing CSV...' : 'Download CSV'}
              </button>
              <button
                type="button"
                onClick={handleOpenWithdrawalModal}
                disabled={isLoadingWithdrawalData || withdrawalAvailableBalance <= 0}
                className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] shadow-md ${
                  isLoadingWithdrawalData || withdrawalAvailableBalance <= 0
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200/50'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Withdraw
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Quick actions for navigation, report export, and withdrawals.
            </p>
          </div>
        </div>

        {withdrawalNotice && (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm font-bold ${
              withdrawalNotice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {withdrawalNotice.message}
          </div>
        )}
      </motion.div>

      {/* ──── Financial Cards ──── */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {financialCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className={`relative overflow-hidden rounded-2xl border ${card.border} ${card.bg} p-5 transition-shadow duration-300 hover:shadow-md group`}
            >
              <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                <Icon className={`w-4.5 h-4.5 ${card.color} opacity-80`} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{card.label}</p>
              <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            </motion.div>
          );
        })}
      </div>

      {isLoadingWithdrawalData && (
        <p className="text-xs font-semibold text-slate-500">Loading withdrawal balances...</p>
      )}

      {/* ──── Detail Cards ──── */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {detailCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              custom={i + 4}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="rounded-2xl border border-slate-200/70 bg-white p-5 hover:shadow-sm transition-shadow group"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{card.label}</p>
              </div>
              <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            </motion.div>
          );
        })}
      </div>

      {!tutorHasSessionEarningMethod && !tutorHasCourseEarningMethod && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-sm font-bold text-slate-700">No earning method is active yet.</p>
          <p className="text-xs text-slate-500 mt-1">
            Start with session bookings, paid course sales, or both. Analytics will appear automatically.
          </p>
        </div>
      )}

      {/* ──── Clean Revenue Core ──── */}
      <div className="grid xl:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 md:p-7 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Revenue Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">Monthly net trend from completed paid activity.</p>
            </div>
          </div>
          <div className="p-5 md:p-6">
            {effectiveMonthlyEarnings.length === 0 ? (
              <div className="text-center py-14 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-500">No monthly earnings data available yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-end">
                {effectiveMonthlyEarnings.map((entry: any) => {
                  const chartMax = Math.max(
                    ...effectiveMonthlyEarnings.map((p: any) => Number(p.totalNetEarnings || 0)),
                    1
                  );
                  const totalHeight = Math.max(10, Math.round((Number(entry.totalNetEarnings || 0) / chartMax) * 150));

                  return (
                    <div key={entry.monthKey} className="flex flex-col items-center gap-2">
                      <div className="h-44 w-full rounded-xl border border-slate-100 bg-slate-50/60 p-2 flex items-end justify-center">
                        <div
                          className="w-5 rounded-md bg-indigo-500 transition-all duration-300"
                          style={{ height: `${totalHeight}px` }}
                          title={`Net earnings: ${formatLkr(Number(entry.totalNetEarnings || 0))}`}
                        />
                      </div>
                      <p className="text-[11px] font-bold text-slate-700">{entry.month}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{formatLkr(Number(entry.totalNetEarnings || 0))}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 md:p-7 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI Revenue Forecasting</h3>
              <p className="text-xs text-slate-500 mt-0.5">Projected tutor net earnings for 30, 60, and 90 days.</p>
            </div>
          </div>
          <div className="p-5 md:p-6">
            {isLoadingRevenueInsights ? (
              <div className="space-y-3">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : !insightsForecast || insightsForecast.windows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Forecast data is not available yet. Complete a few paid sessions to generate projections.
              </div>
            ) : (
              <div className="space-y-3">
                {insightsForecast.windows.map((window) => (
                  <div key={window.days} className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-800">Next {window.days} Days</p>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{window.confidence} confidence</span>
                    </div>
                    <p className="text-xl font-extrabold text-emerald-700 mt-1">{formatLkr(window.projectedNetEarning)}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Historical: {formatLkr(window.historicalProjection)} • Upcoming confirmed: {formatLkr(window.upcomingConfirmedNet)}
                    </p>
                  </div>
                ))}
                {insightsForecast.fallback && (
                  <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {insightsForecast.fallbackMessage || 'Forecast is using fallback logic because historical data is limited.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ──── AI Pricing + Tax Prep ──── */}
      <div className="grid xl:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 md:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Brain className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">AI Pricing Suggestions</h3>
                <p className="text-xs text-slate-500 mt-0.5">Rate guidance based on demand, outcomes, and quality signals.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetryRevenueInsights}
              disabled={isLoadingRevenueInsights}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                isLoadingRevenueInsights
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRevenueInsights ? 'animate-spin' : ''}`} />
              {isLoadingRevenueInsights ? 'Refreshing...' : 'Generate New Suggestion'}
            </button>
          </div>
          <div className="p-5 md:p-6">
            {!insightsPricing ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Pricing insights will appear once enough booking performance data is available.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current Rate</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1">{formatLkr(displayedCurrentPricingRate)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Suggested Rate</p>
                      {isPricingSuggestionApplied && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border border-emerald-300 bg-emerald-100 text-emerald-700">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Applied
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-extrabold text-emerald-700 mt-1">{formatLkr(insightsPricing.suggestedHourlyRate)}</p>
                    <p className="text-[11px] text-emerald-700 mt-1">
                      Range: {formatLkr(insightsPricing.suggestedRange.min)} - {formatLkr(insightsPricing.suggestedRange.max)}
                    </p>
                  </div>
                </div>
                {isPricingSuggestionApplied && pricingSuggestionApplyState?.message && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {pricingSuggestionApplyState.message}
                  </div>
                )}
                {!isPricingSuggestionApplied && isSuggestedRateAlreadyCurrent && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
                    Your current hourly rate already matches this suggestion.
                  </div>
                )}
                <p className="text-sm font-medium text-slate-700">{insightsPricing.reason}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 px-3 py-2 bg-white">Demand (30d): <span className="font-bold text-slate-900">{insightsPricing.metrics.bookingDemandLast30Days}</span></div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2 bg-white">Completed: <span className="font-bold text-slate-900">{insightsPricing.metrics.completedSessions}</span></div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2 bg-white">Completion: <span className="font-bold text-slate-900">{Math.round(insightsPricing.metrics.completionRate * 100)}%</span></div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2 bg-white">Cancellation: <span className="font-bold text-slate-900">{Math.round(insightsPricing.metrics.cancellationRate * 100)}%</span></div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Confidence: {insightsPricing.confidence}</p>
                  <button
                    type="button"
                    onClick={handleApplyPricingSuggestion}
                    disabled={
                      isApplyingPricingSuggestion ||
                      isLoadingRevenueInsights ||
                      isPricingSuggestionApplied ||
                      isSuggestedRateAlreadyCurrent
                    }
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      isApplyingPricingSuggestion ||
                      isLoadingRevenueInsights ||
                      isPricingSuggestionApplied ||
                      isSuggestedRateAlreadyCurrent
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isApplyingPricingSuggestion
                      ? 'Applying...'
                      : isPricingSuggestionApplied
                        ? 'Applied'
                        : isSuggestedRateAlreadyCurrent
                          ? 'Already Current'
                          : 'Apply Suggested Rate'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 md:p-7 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Tax Prep Helper</h3>
              <p className="text-xs text-slate-500 mt-0.5">Monthly accounting summary by income, fees, refunds, and withdrawals.</p>
            </div>
          </div>
          <div className="p-5 md:p-6">
            {!insightsTax || insightsTax.monthlySummaries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Tax prep data will populate once payment activity is available.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Month', 'Session Income', 'Course Sales', 'Platform Fees', 'Refunds', 'Withdrawals', 'Net Taxable'].map((header) => (
                          <th key={header} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {insightsTax.monthlySummaries.slice(-6).map((month) => (
                        <tr key={month.monthKey}>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{month.month}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{formatLkr(month.sessionIncome)}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{formatLkr(month.courseSales)}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{formatLkr(month.platformFees)}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{formatLkr(month.refunds)}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-700">{formatLkr(month.withdrawals)}</td>
                          <td className="px-3 py-2 text-xs font-bold text-emerald-700">{formatLkr(month.netTaxableIncome)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
                  <p className="font-bold text-slate-700">Totals</p>
                  <p className="text-slate-600 mt-1">
                    Net Taxable: <span className="font-bold text-emerald-700">{formatLkr(insightsTax.totals.netTaxableIncome)}</span> •
                    Platform Fees: <span className="font-bold text-slate-800"> {formatLkr(insightsTax.totals.platformFees)}</span> •
                    Refunds: <span className="font-bold text-slate-800"> {formatLkr(insightsTax.totals.refunds)}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ──── AI Insights Summary ──── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
      >
        <div className="p-6 md:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Brain className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI Revenue Insights</h3>
              <p className="text-xs text-slate-500 mt-0.5">Narrative guidance generated from trusted financial metrics.</p>
            </div>
          </div>
          {shouldShowAiRetry && (
            <button
              type="button"
              onClick={handleRetryRevenueInsights}
              disabled={isLoadingRevenueInsights}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                isLoadingRevenueInsights
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRevenueInsights ? 'animate-spin' : ''}`} />
              {isLoadingRevenueInsights ? 'Retrying...' : 'Retry AI Insights'}
            </button>
          )}
        </div>
        <div className="p-5 md:p-6 space-y-4">
          {revenueInsightsError && !isLoadingRevenueInsights && (
            <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {revenueInsightsError}
            </p>
          )}
          {isLoadingRevenueInsights ? (
            <div className="space-y-3">
              {[1, 2, 3].map((row) => (
                <div key={row} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : !insightsAi ? (
            <p className="text-sm text-slate-600">AI summary will appear after revenue insights are loaded.</p>
          ) : (
            <>
              {insightsAi.warning && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {insightsAi.warning}
                </p>
              )}
              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Forecast</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{insightsAi.forecastSummary}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Pricing</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{insightsAi.pricingSummary}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Tax Prep</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{insightsAi.taxSummary}</p>
                </div>
              </div>
              {insightsAi.actionItems.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Recommended Actions</p>
                  <div className="space-y-1.5">
                    {insightsAi.actionItems.map((item, index) => (
                      <p key={`${item}-${index}`} className="text-sm font-medium text-slate-700">{index + 1}. {item}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* ──── Withdrawal History ──── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
      >
        <div className="p-6 md:p-7 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Withdrawal History</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Review payout requests, statuses, and processing updates.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 md:p-6">
          {isLoadingWithdrawalData ? (
            <div className="space-y-3">
              {[1, 2, 3].map((row) => (
                <div key={row} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : withdrawalRequests.length === 0 ? (
            <div className="text-center py-14 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
              <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">No withdrawal requests yet.</p>
              <p className="text-xs text-slate-400 mt-1">Submit your first request once your available balance is above zero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50/80 border-b border-slate-200/70">
                  <tr>
                    {['Requested', 'Amount', 'Payout Method', 'Details', 'Status', 'Processed'].map((h) => (
                      <th key={h} className={`${h === 'Amount' ? 'text-right' : 'text-left'} px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {withdrawalRequests.map((request: any) => {
                    const requestedDate = Date.parse(String(request.requestedAt || ''));
                    const processedDate = Date.parse(String(request.processedAt || ''));
                    return (
                      <tr key={request.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">
                          {Number.isNaN(requestedDate)
                            ? 'N/A'
                            : new Date(requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right whitespace-nowrap">{formatLkr(request.amount)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">{getWithdrawalPayoutMethodLabel(request.payoutMethodType)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px]">
                          <p className="font-medium line-clamp-2">{request.payoutMethodDetails || 'N/A'}</p>
                          {request.note && <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">Note: {request.note}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getWithdrawalStatusPillClassName(request.status)}`}>
                            {getWithdrawalStatusLabel(request.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                          {Number.isNaN(processedDate)
                            ? '--'
                            : new Date(processedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* ──── Payment History ──── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
      >
        <div className="p-6 md:p-7 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Payment History</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Transaction timeline for session bookings and course purchases.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</span>
                <select
                  value={tutorTransactionFilter}
                  onChange={(e) => setTutorTransactionFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all outline-none"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="refunded_or_cancelled">Refunded/Cancelled</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sort</span>
                <select
                  value={tutorTransactionSortOrder}
                  onChange={(e) => setTutorTransactionSortOrder(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="p-5 md:p-6">
          {isLoadingUserData ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : visiblePaymentRows.length === 0 ? (
            <div className="text-center py-14 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">No transactions found for current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="w-full min-w-[960px]">
                <thead className="bg-slate-50/80 border-b border-slate-200/70">
                  <tr>
                    {['Date', 'Session/Course', 'Student', 'Payment Type', 'Amount', 'Platform Fee', 'Net Earning', 'Status'].map((h) => (
                      <th key={h} className={`${['Amount', 'Platform Fee', 'Net Earning'].includes(h) ? 'text-right' : 'text-left'} px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visiblePaymentRows.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">{t.dateLabel}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-900">{t.itemName}</p>
                        {t.paymentReference && (
                          <p className="text-[11px] text-slate-500 mt-1">Ref: {t.paymentReference}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{t.studentName}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border border-slate-200/70 bg-slate-50 text-slate-700">
                          {t.paymentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatLkr(t.amount)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-600 text-right">{formatLkr(t.platformFee)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-700 text-right">{formatLkr(t.netEarning)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getTransactionStatusPillClassName(t.status)}`}>
                          {getTransactionStatusLabel(t.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
