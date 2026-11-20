/**
 * Metric / Stat Card Component
 * Tabler 1.7.4 Enterprise KPI Card
 */

export function renderStatCard({ title, value, unit = '', subtitle = '', icon = '📊', color = 'gold' }) {
  const avatarClass = color === 'forest' || color === 'success' 
    ? 'avatar-forest' 
    : color === 'warning' || color === 'amber'
    ? 'bg-warning-lt text-warning'
    : color === 'danger' || color === 'red'
    ? 'bg-danger-lt text-danger'
    : 'avatar-gold';

  return `
    <div class="card card-sm">
      <div class="card-body">
        <div class="row align-items-center">
          <div class="col-auto">
            <span class="avatar avatar-md ${avatarClass} rounded">
              <span class="fs-3">${icon}</span>
            </span>
          </div>
          <div class="col">
            <div class="metric-subheader">${title}</div>
            <div class="metric-number">
              ${value}<span class="metric-unit">${unit}</span>
            </div>
            ${subtitle ? `<div class="text-muted text-xs mt-1">${subtitle}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}
