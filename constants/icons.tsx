/**
 * סט אייקונים אחיד לכל הפעולות במערכת – שימוש ב-lucide-react.
 * מבטיח עקביות ויזואלית בין דשבורד, פרופיל תלמיד, העלאה והגדרות.
 */
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  FileSpreadsheet,
  GraduationCap,
  Grid3X3,
  LayoutDashboard,
  Minus,
  Moon,
  Pencil,
  PlusCircle,
  Settings,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';

/** אייקונים לפעולות ניווט וממשק */
export const NavIcons = {
  Dashboard: LayoutDashboard,
  TeachersAnalytics: BarChart3,
  SubjectMatrix: Grid3X3,
  Upload: Upload,
  Settings: Settings,
  AddClass: PlusCircle,
  Class: BookOpen,
  Edit: Pencil,
  Delete: Trash2,
  Check: Check,
  Privacy: Eye,
  PrivacyOff: EyeOff,
  Dark: Moon,
  Light: Sun,
  Back: ChevronRight,
} as const;

/** אייקונים למדדים: ציונים, סיכון, מגמות */
export const MetricIcons = {
  Students: Users,
  ClassAverage: BarChart2,
  Risk: AlertTriangle,
  Absences: AlertTriangle,
  NegativeEvents: AlertTriangle,
  TrendUp: ArrowUpRight,
  TrendDown: ArrowDownRight,
  TrendStable: Minus,
  Improving: TrendingUp,
  Declining: TrendingDown,
  Check: Check,
} as const;

/** אייקונים להעלאת קבצים */
export const FileIcons = {
  Upload: Upload,
  Behavior: FileText,
  Grades: FileSpreadsheet,
  LogoFallback: GraduationCap,
} as const;

/** גודל ברירת מחדל לאייקונים בכפתורים/כרטיסים */
export const ICON_SIZE_BUTTON = 18;
export const ICON_SIZE_CARD = 22;
export const ICON_SIZE_SM = 14;
