import { createElement, type ComponentType, type CSSProperties, type ReactElement, type SVGProps } from 'react'
import {
  AlertTriangle,
  AppWindow,
  ArrowUpDown,
  BarChart3,
  Bell,
  Bolt,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code,
  Copy,
  Cpu,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flame,
  Folder,
  GitBranch,
  Globe,
  Grid2X2,
  HelpCircle,
  Info,
  LayoutDashboard,
  List,
  Lock,
  Maximize2,
  Minus,
  Monitor,
  Network,
  Package,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  Skull,
  Square,
  Tag,
  Terminal,
  Trash2,
  Upload,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  IconAdjustments,
  IconBox,
  IconCpu,
  IconDatabase,
  IconForms,
  IconLayoutDashboard,
  IconPalette,
  IconSettings,
} from '@tabler/icons-react'
import {
  CheckIcon,
  ChevronDownIcon,
  Cross1Icon,
  DotFilledIcon,
  GearIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons'
import {
  BellIcon,
  InformationCircleIcon,
  MegaphoneIcon,
  RocketLaunchIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import {
  SiAnthropic,
  SiAnthropicHex,
  SiClaude,
  SiClaudeHex,
  SiGithub,
  SiGithubHex,
  SiGoogle,
  SiGoogleHex,
  SiGooglegemini,
  SiGooglegeminiHex,
} from '@icons-pack/react-simple-icons'
import type { IconLibrary } from '@shared/icon-library'
import openAILogoUrl from '../icons/brand-logos/openai-symbol.svg'

export type RendererIconToken = `${IconLibrary}:${string}`

export interface RendererIconRenderProps {
  className?: string
  color?: string
  size: number
  strokeWidth?: number
  style?: CSSProperties
}

export interface RendererIconEntry {
  kind: 'component' | 'asset'
  render?: (props: RendererIconRenderProps) => ReactElement
  src?: string
}

type SvgIconProps = SVGProps<SVGSVGElement> & {
  color?: string
  size?: number | string
  title?: string
}

type SvgIconComponent = ComponentType<SvgIconProps>

function svgIcon(Component: unknown, defaultColor?: string): RendererIconEntry {
  const SvgComponent = Component as SvgIconComponent

  return {
    kind: 'component',
    render: ({ className, color, size, strokeWidth, style }) => createElement(SvgComponent, {
      'aria-hidden': true,
      className,
      color: color ?? defaultColor,
      focusable: false,
      height: size,
      size,
      strokeWidth,
      style,
      width: size,
    }),
  }
}

function assetIcon(src: string): RendererIconEntry {
  return { kind: 'asset', src }
}

export const RENDERER_ICON_REGISTRY = {
  lucide: {
    AlertTriangle: svgIcon(AlertTriangle),
    AppWindow: svgIcon(AppWindow),
    ArrowUpDown: svgIcon(ArrowUpDown),
    BarChart3: svgIcon(BarChart3),
    Bell: svgIcon(Bell),
    Bolt: svgIcon(Bolt),
    Bot: svgIcon(Bot),
    Brain: svgIcon(Brain),
    Check: svgIcon(Check),
    CheckCircle2: svgIcon(CheckCircle2),
    ChevronDown: svgIcon(ChevronDown),
    ChevronLeft: svgIcon(ChevronLeft),
    ChevronRight: svgIcon(ChevronRight),
    ChevronUp: svgIcon(ChevronUp),
    Code: svgIcon(Code),
    Copy: svgIcon(Copy),
    Cpu: svgIcon(Cpu),
    Download: svgIcon(Download),
    Edit2: svgIcon(Edit2),
    ExternalLink: svgIcon(ExternalLink),
    Eye: svgIcon(Eye),
    FileText: svgIcon(FileText),
    Filter: svgIcon(Filter),
    Flame: svgIcon(Flame),
    Folder: svgIcon(Folder),
    GitBranch: svgIcon(GitBranch),
    Globe: svgIcon(Globe),
    Grid2X2: svgIcon(Grid2X2),
    HelpCircle: svgIcon(HelpCircle),
    Info: svgIcon(Info),
    LayoutDashboard: svgIcon(LayoutDashboard),
    List: svgIcon(List),
    Lock: svgIcon(Lock),
    Maximize2: svgIcon(Maximize2),
    Minus: svgIcon(Minus),
    Monitor: svgIcon(Monitor),
    Network: svgIcon(Network),
    Package: svgIcon(Package),
    Palette: svgIcon(Palette),
    Pause: svgIcon(Pause),
    Pencil: svgIcon(Pencil),
    Play: svgIcon(Play),
    Plus: svgIcon(Plus),
    RefreshCw: svgIcon(RefreshCw),
    ScanLine: svgIcon(ScanLine),
    Search: svgIcon(Search),
    Settings: svgIcon(Settings),
    Skull: svgIcon(Skull),
    Square: svgIcon(Square),
    Tag: svgIcon(Tag),
    Terminal: svgIcon(Terminal),
    Trash2: svgIcon(Trash2),
    Upload: svgIcon(Upload),
    Wrench: svgIcon(Wrench),
    X: svgIcon(X),
    XCircle: svgIcon(XCircle),
    Zap: svgIcon(Zap),
  },
  tabler: {
    Adjustments: svgIcon(IconAdjustments),
    Box: svgIcon(IconBox),
    Cpu: svgIcon(IconCpu),
    Database: svgIcon(IconDatabase),
    Forms: svgIcon(IconForms),
    LayoutDashboard: svgIcon(IconLayoutDashboard),
    Palette: svgIcon(IconPalette),
    Settings: svgIcon(IconSettings),
  },
  radix: {
    Check: svgIcon(CheckIcon),
    ChevronDown: svgIcon(ChevronDownIcon),
    Cross1: svgIcon(Cross1Icon),
    DotFilled: svgIcon(DotFilledIcon),
    Gear: svgIcon(GearIcon),
    MagnifyingGlass: svgIcon(MagnifyingGlassIcon),
  },
  heroicons: {
    Bell: svgIcon(BellIcon),
    InformationCircle: svgIcon(InformationCircleIcon),
    Megaphone: svgIcon(MegaphoneIcon),
    RocketLaunch: svgIcon(RocketLaunchIcon),
    Sparkles: svgIcon(SparklesIcon),
  },
  brand: {
    Anthropic: svgIcon(SiAnthropic, SiAnthropicHex),
    Claude: svgIcon(SiClaude, SiClaudeHex),
    GitHub: svgIcon(SiGithub, SiGithubHex),
    Google: svgIcon(SiGoogle, SiGoogleHex),
    GoogleGemini: svgIcon(SiGooglegemini, SiGooglegeminiHex),
    OpenAI: assetIcon(openAILogoUrl),
  },
} satisfies Record<IconLibrary, Record<string, RendererIconEntry>>

export function findRendererIconEntry(library: IconLibrary, name: string): RendererIconEntry | null {
  const entries = RENDERER_ICON_REGISTRY[library] as Record<string, RendererIconEntry>
  return entries[name] ?? null
}

export const BRAND_ICON_NAMES = Object.freeze(
  Object.keys(RENDERER_ICON_REGISTRY.brand),
)
