/**
 * Badges and Status Labels
 * Tabler 1.7.4 Enterprise Status Indicators
 */

export function renderStateBadge(state) {
  let cssClass = 'badge bg-secondary-lt';
  let label = state;

  switch (state) {
    case 'CONFIRMED_BY_BOTH':
      cssClass = 'badge bg-success-lt';
      label = '✓ Confirmed by Both';
      break;
    case 'AWAITING_CONFIRMATION':
      cssClass = 'badge bg-warning-lt';
      label = '⏳ Awaiting Confirmation';
      break;
    case 'CORRECTION_REQUESTED':
      cssClass = 'badge bg-info-lt';
      label = '✏️ Correction Requested';
      break;
    case 'DISPUTED':
      cssClass = 'badge bg-danger-lt';
      label = '⚠️ Disputed';
      break;
    case 'BALANCED':
      cssClass = 'badge bg-success-lt';
      label = '⚖️ Balanced';
      break;
    case 'WITHIN_TOLERANCE':
      cssClass = 'badge bg-info-lt';
      label = 'Within Tolerance';
      break;
    case 'REVIEW':
      cssClass = 'badge bg-danger-lt';
      label = 'Review Required';
      break;
    case 'APPROVED':
      cssClass = 'badge bg-success-lt';
      label = '✓ Approved';
      break;
    case 'REJECTED':
      cssClass = 'badge bg-danger-lt';
      label = '✕ Rejected';
      break;
    case 'DRAFT':
      cssClass = 'badge bg-secondary-lt';
      label = 'Draft';
      break;
    case 'ACTIVE':
      cssClass = 'badge bg-primary-lt';
      label = 'Active';
      break;
    default:
      cssClass = 'badge bg-secondary-lt';
  }

  return `<span class="${cssClass}">${label}</span>`;
}

export function renderPurityBadge(karat) {
  return `<span class="badge badge-gold">${karat}K Gold</span>`;
}
