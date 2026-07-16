type StatCardProps = {
  label: string
  value: string
  change: string
  trend?: 'positive' | 'neutral' | 'warning'
}

export function StatCard({ label, value, change, trend = 'positive' }: StatCardProps) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span className={`stat-change ${trend}`}>{change}</span>
    </article>
  )
}
