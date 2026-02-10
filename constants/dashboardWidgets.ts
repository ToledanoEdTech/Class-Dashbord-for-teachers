/** מזהי רכיבי הדשבורד שניתן להציג/להסתיר */
export const DASHBOARD_WIDGET_IDS = [
  'summary',
  'dateFilter',
  'advancedFilters',
  'kpiCards',
  'timeline',
  'periodComparison',
  'gradeDistribution',
  'behaviorChart',
  'heatmap',
  'studentsList',
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  summary: 'סיכום מהיר ותשומת לב מיידית',
  dateFilter: 'סינון לפי טווח תאריכים',
  advancedFilters: 'סינון מתקדם',
  kpiCards: 'כרטיסי מדדים (KPI)',
  timeline: 'מגמה כיתתית לאורך זמן',
  periodComparison: 'השוואה בין תקופות',
  gradeDistribution: 'התפלגות ציונים',
  behaviorChart: 'מדד התנהגות',
  heatmap: 'מפת חום כיתתית',
  studentsList: 'רשימת תלמידים',
};

export type DashboardWidgetsState = Record<DashboardWidgetId, boolean>;

export function getDefaultDashboardWidgets(): DashboardWidgetsState {
  const state = {} as DashboardWidgetsState;
  DASHBOARD_WIDGET_IDS.forEach((id) => {
    state[id] = id !== 'summary'; // ברירת מחדל: בלי סיכום מהיר ותשומת לב מיידית
  });
  return state;
}

export function normalizeDashboardWidgets(
  partial: Partial<DashboardWidgetsState> | null | undefined
): DashboardWidgetsState {
  const defaults = getDefaultDashboardWidgets();
  if (!partial || typeof partial !== 'object') return defaults;
  const result = { ...defaults };
  DASHBOARD_WIDGET_IDS.forEach((id) => {
    if (typeof partial[id] === 'boolean') result[id] = partial[id];
  });
  return result;
}
