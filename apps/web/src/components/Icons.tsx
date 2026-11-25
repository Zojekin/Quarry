import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Command,
  Eye,
  FileText,
  Folder,
  History,
  Home,
  LayoutGrid,
  List,
  MoreHorizontal,
  PanelLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  eye: Eye,
  play: Play,
  pause: Pause,
  pencil: Pencil,
  forward: ArrowRight,
  back: ArrowLeft,
  grid: LayoutGrid,
  list: List,
  export: Upload,
  close: X,
  chevron: ChevronDown,
  check: Check,
  home: Home,
  library: BookOpen,
  mistakes: BookMarked,
  records: History,
  trash: Trash2,
  settings: Settings,
  folder: Folder,
  paper: FileText,
  panel: PanelLeft,
  search: Search,
  plus: Plus,
  more: MoreHorizontal,
  command: Command,
  clock: Clock,
  reset: RotateCcw,
};

export type IconName = keyof typeof icons;

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Component = icons[name] ?? FileText;
  return <Component className={className} strokeWidth={1.75} aria-hidden="true" />;
}
