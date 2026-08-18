const CATEGORY_COLORS = {
  '일반음식점': '#c2413b',
  '휴게음식점': '#2f78b7',
  '미용업': '#9850a4',
}

export function getClosureCategory(point) {
  // Older generated JSON did not have category, and contains general restaurants only.
  return point.category || '일반음식점'
}

export function getClosureCategoryColor(point) {
  return CATEGORY_COLORS[getClosureCategory(point)] || '#66736d'
}
