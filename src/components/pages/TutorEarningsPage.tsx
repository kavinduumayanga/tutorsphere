/**
 * TutorEarningsPage – Modern SaaS-style Revenue Dashboard
 * Pure UI component. No backend logic changes.
 */
import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock,
  TrendingUp,
  Wallet,
  CircleDollarSign,
  ShieldCheck,
  CreditCard,
  Receipt,
  Download,
  FileText,
  BookOpen,
  Activity,
} from 'lucide-react';
import { formatLkr } from '../../utils/currency';

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
  } = props;

  /* ─── Top financial cards ─── */
  const financialCards = [
    { label: 'Total Net Earnings', value: formatLkr(withdrawalTotalEarnings), color: 'text-slate-900', bg: 'bg-gradient-to-br from-slate-50 to-slate-100/60', iconBg: 'bg-slate-200/60', icon: CircleDollarSign, border: 'border-slate-200/80' },
    { label: 'Withdrawn', value: formatLkr(withdrawalWithdrawnAmount), color: 'text-emerald-700', bg: 'bg-gradient-to-br from-emerald-50/80 to-emerald-100/40', iconBg: 'bg-emerald-100', icon: Download, border: 'border-emerald-200/60' },
    { label: 'Pending Withdrawals', value: formatLkr(withdrawalPendingAmount), color: 'text-amber-700', bg: 'bg-gradient-to-br from-amber-50/80 to-amber-100/40', iconBg: 'bg-amber-100', icon: Clock, border: 'border-amber-200/60' },
    { label: 'Available Balance', value: formatLkr(withdrawalAvailableBalance), color: 'text-emerald-600', bg: 'bg-gradient-to-br from-emerald-50/60 to-teal-100/30', iconBg: 'bg-emerald-100/80', icon: Wallet, border: 'border-emerald-200/60' },
  ];

  const detailCards = [
    { label: 'Session Earnings', value: formatLkr(tutorSessionNetEarnings), color: 'text-indigo-700', icon: Activity },
    { label: 'Course Earnings', value: formatLkr(tutorCourseNetEarnings), color: 'text-cyan-700', icon: BookOpen },
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleOpenWithdrawalModal}
              disabled={isLoadingWithdrawalData || withdrawalAvailableBalance <= 0}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] shadow-md ${
                isLoadingWithdrawalData || withdrawalAvailableBalance <= 0
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200/50'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Withdraw Money
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
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

      {/* ──── Monthly Earnings Trend + Breakdown ──── */}
      <div className="grid xl:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="xl:col-span-2 rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 md:p-7 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Monthly Earnings Trend</h3>
          </div>
          <div className="p-5 md:p-6">
            {tutorRecentMonthlyEarnings.length === 0 ? (
              <div className="text-center py-14 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-500">No paid earnings available yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-end">
                {tutorRecentMonthlyEarnings.map((entry: any) => {
                  const chartMax = Math.max(
                    ...tutorRecentMonthlyEarnings.map((p: any) => p.totalNetEarnings),
                    1
                  );
                  const sessionH = Math.max(10, Math.round((entry.sessionNetEarnings / chartMax) * 150));
                  const courseH = Math.max(10, Math.round((entry.courseNetEarnings / chartMax) * 150));

                  return (
                    <div key={entry.monthKey} className="flex flex-col items-center gap-2 group">
                      <div className="h-44 w-full rounded-xl border border-slate-100 bg-slate-50/60 p-2 flex items-end justify-center">
                        <div className="flex items-end gap-1">
                          {tutorHasSessionEarningMethod && (
                            <div
                              className="w-4 rounded-md bg-indigo-500 transition-all duration-300 group-hover:bg-indigo-600"
                              style={{ height: `${sessionH}px` }}
                              title={`Session earnings: ${formatLkr(entry.sessionNetEarnings)}`}
                            />
                          )}
                          {tutorHasCourseEarningMethod && (
                            <div
                              className="w-4 rounded-md bg-cyan-500 transition-all duration-300 group-hover:bg-cyan-600"
                              style={{ height: `${courseH}px` }}
                              title={`Course earnings: ${formatLkr(entry.courseNetEarnings)}`}
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] font-bold text-slate-700">{entry.month}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{formatLkr(entry.totalNetEarnings)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Source breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 md:p-7 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Source Breakdown</h3>
          </div>
          <div className="p-5 md:p-6 space-y-5">
            {tutorHasSessionEarningMethod && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sessions</p>
                  <p className="text-xs font-bold text-indigo-700">{tutorSessionSharePercent}%</p>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                    style={{ width: `${tutorSessionSharePercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {formatLkr(tutorSessionNetEarnings)} • {tutorCompletedPaidBookings.length} sessions
                </p>
              </div>
            )}

            {tutorHasCourseEarningMethod && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Course Sales</p>
                  <p className="text-xs font-bold text-cyan-700">{tutorCourseSharePercent}%</p>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all duration-700"
                    style={{ width: `${tutorCourseSharePercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {formatLkr(tutorCourseNetEarnings)} • {tutorPaidCourseEnrollmentsCount} enrollments
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Paid Transactions</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{tutorPaidTransactions.length}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ──── Session & Course Earnings panels ──── */}
      <div className="grid xl:grid-cols-2 gap-6">
        {/* Session earnings */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Activity className="w-4.5 h-4.5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Earnings by Sessions</h3>
          </div>
          <div className="p-5">
            {!tutorHasSessionEarningMethod ? (
              <p className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-3">
                Session-based earning method is not active.
              </p>
            ) : tutorPaidSessionTransactions.length === 0 ? (
              <p className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-3">
                No paid and completed session transactions yet.
              </p>
            ) : (
              <div className="space-y-3">
                {[...tutorPaidSessionTransactions]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 8)
                  .map((t: any) => (
                    <div key={t.id} className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t.itemName}</p>
                          <p className="text-xs text-slate-500 mt-1">{t.dateLabel} • {t.studentName}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-700">{formatLkr(t.netEarning)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Course earnings */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-cyan-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Earnings by Course Sales</h3>
          </div>
          <div className="p-5">
            {!tutorHasCourseEarningMethod ? (
              <p className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-3">
                Course-based earning method is not active.
              </p>
            ) : tutorPaidCourseTransactions.length === 0 ? (
              <p className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-3">
                No paid course purchase transactions yet.
              </p>
            ) : (
              <div className="space-y-3">
                {[...tutorPaidCourseTransactions]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 8)
                  .map((t: any) => (
                    <div key={t.id} className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t.itemName}</p>
                          <p className="text-xs text-slate-500 mt-1">{t.dateLabel} • {t.studentName}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-700">{formatLkr(t.netEarning)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ──── Withdrawal History ──── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
      >
        <div className="p-6 md:p-7 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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
            <button
              type="button"
              onClick={handleOpenWithdrawalModal}
              disabled={isLoadingWithdrawalData || withdrawalAvailableBalance <= 0}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${
                isLoadingWithdrawalData || withdrawalAvailableBalance <= 0
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200/50'
              }`}
            >
              Withdraw Money
            </button>
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
          ) : filteredTutorTransactions.length === 0 ? (
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
                  {filteredTutorTransactions.map((t: any) => (
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
