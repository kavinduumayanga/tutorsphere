const lkrFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'LKR',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatLkr = (amount: number | string | null | undefined): string => {
  const numericAmount = typeof amount === 'string' ? Number(amount) : amount;
  const safeAmount = Number.isFinite(numericAmount) ? Number(numericAmount) : 0;
  return lkrFormatter.format(safeAmount);
};
