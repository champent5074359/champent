export function Header() {
  return (
    <header className="header">
      <div>
        <p className="eyebrow">Overview</p>
        <h1>Dashboard</h1>
      </div>
      <div className="header-actions">
        <button className="branch-switcher" type="button" aria-label="Change active branch">
          <span className="branch-icon" aria-hidden="true">⌂</span>
          <span><strong>BusinessOS Demo</strong><small>Main Branch</small></span>
          <span aria-hidden="true">⌄</span>
        </button>
        <button className="avatar" type="button" aria-label="Open profile menu">BO</button>
      </div>
    </header>
  )
}
