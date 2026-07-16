const thaiCurrency = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
})

export function formatCurrency(amount: number) {
  return thaiCurrency.format(amount)
}
