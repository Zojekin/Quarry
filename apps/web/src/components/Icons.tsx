import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Folder,
  History,
  Home,
  Layers,
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
  SquareTerminal,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

const icons = {
  eye: Eye,
  play: Play,
  pause: Pause,
  pencil: Pencil,
  edit: Pencil,
  forward: ArrowRight,
  back: ArrowLeft,
  grid: LayoutGrid,
  list: List,
  export: Upload,
  download: Download,
  close: X,
  cross: X,
  chevron: ChevronDown,
  check: Check,
  home: Home,
  library: BookOpen,
  mistakes: BookMarked,
  records: History,
  trash: Trash2,
  settings: Settings,
  folder: Folder,
  bank: Layers,
  paper: FileText,
  panel: PanelLeft,
  search: Search,
  plus: Plus,
  more: MoreHorizontal,
  command: SquareTerminal,
  clock: Clock,
  reset: RotateCcw,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Component = icons[name];
  return <Component className={className} strokeWidth={1.75} aria-hidden="true" />;
}
