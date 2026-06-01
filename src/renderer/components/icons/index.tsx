import type { CSSProperties } from 'react'
import { Icon } from '../icon/Icon'

export interface IconProps {
  className?: string
  size?: number
  style?: CSSProperties
}

export const LEGACY_ICON_TOKENS = {
  AIIcon: 'lucide:Bot',
  AlertIcon: 'lucide:AlertTriangle',
  BellIcon: 'lucide:Bell',
  CheckIcon: 'lucide:Check',
  ChevronDownIcon: 'lucide:ChevronDown',
  ChevronIcon: 'lucide:ChevronRight',
  ChevronLeftIcon: 'lucide:ChevronLeft',
  ChevronRightIcon: 'lucide:ChevronRight',
  ChevronUpIcon: 'lucide:ChevronUp',
  ClockIcon: 'lucide:Clock',
  CloseIcon: 'lucide:X',
  CodeIcon: 'lucide:Code',
  CopyIcon: 'lucide:Copy',
  DownloadIcon: 'lucide:Download',
  ExternalLinkIcon: 'lucide:ExternalLink',
  EyeIcon: 'lucide:Eye',
  FilterIcon: 'lucide:Filter',
  FolderIcon: 'lucide:Folder',
  GearIcon: 'radix:Gear',
  GitBranchIcon: 'lucide:GitBranch',
  GlobeIcon: 'lucide:Globe',
  GridIcon: 'lucide:Grid2X2',
  GroupIcon: 'lucide:Grid2X2',
  InfoIcon: 'lucide:Info',
  KillIcon: 'lucide:Skull',
  LayoutIcon: 'lucide:LayoutDashboard',
  LightningIcon: 'lucide:Bolt',
  ListIcon: 'lucide:List',
  LogIcon: 'lucide:FileText',
  MaximizeIcon: 'lucide:Maximize2',
  MenuIcon: 'lucide:Menu',
  MinimizeIcon: 'lucide:Minus',
  MonitorIcon: 'lucide:BarChart3',
  NetworkIcon: 'lucide:Network',
  PackageIcon: 'lucide:Package',
  PaletteIcon: 'lucide:Palette',
  PencilIcon: 'lucide:Pencil',
  PinIcon: 'lucide:Pin',
  PlayIcon: 'lucide:Play',
  PlusIcon: 'lucide:Plus',
  PopoutIcon: 'lucide:PictureInPicture2',
  PortIcon: 'lucide:Network',
  ProcessIcon: 'lucide:Cpu',
  RefreshIcon: 'lucide:RefreshCw',
  ScanIcon: 'lucide:ScanLine',
  SearchIcon: 'lucide:Search',
  SettingsIcon: 'lucide:Settings',
  SortIcon: 'lucide:ArrowUpDown',
  StopIcon: 'lucide:Square',
  TagIcon: 'lucide:Tag',
  TerminalIcon: 'lucide:Terminal',
  TopologyIcon: 'lucide:Network',
  TrashIcon: 'lucide:Trash2',
  TreeIcon: 'lucide:GitBranch',
  UploadIcon: 'lucide:Upload',
  WindowIcon: 'lucide:AppWindow',
  WrenchIcon: 'lucide:Wrench',
} as const

type LegacyIconName = keyof typeof LEGACY_ICON_TOKENS

function LegacyIcon({
  className = '',
  iconName,
  size = 20,
  style,
}: IconProps & { iconName: LegacyIconName }) {
  return (
    <Icon
      className={className}
      decorative
      size={size}
      style={style}
      token={LEGACY_ICON_TOKENS[iconName]}
    />
  )
}

export function GearIcon(props: IconProps) {
  return <LegacyIcon iconName="GearIcon" {...props} />
}

export function PencilIcon(props: IconProps) {
  return <LegacyIcon iconName="PencilIcon" {...props} />
}

export function PinIcon(props: IconProps) {
  return <LegacyIcon iconName="PinIcon" {...props} />
}

export function PopoutIcon(props: IconProps) {
  return <LegacyIcon iconName="PopoutIcon" {...props} />
}

export function LightningIcon(props: IconProps) {
  return <LegacyIcon iconName="LightningIcon" {...props} />
}

export function PlayIcon(props: IconProps) {
  return <LegacyIcon iconName="PlayIcon" {...props} />
}

export function StopIcon(props: IconProps) {
  return <LegacyIcon iconName="StopIcon" {...props} />
}

export function FolderIcon(props: IconProps) {
  return <LegacyIcon iconName="FolderIcon" {...props} />
}

export function TagIcon(props: IconProps) {
  return <LegacyIcon iconName="TagIcon" {...props} />
}

export function GroupIcon(props: IconProps) {
  return <LegacyIcon iconName="GroupIcon" {...props} />
}

export function LogIcon(props: IconProps) {
  return <LegacyIcon iconName="LogIcon" {...props} />
}

export function MonitorIcon(props: IconProps) {
  return <LegacyIcon iconName="MonitorIcon" {...props} />
}

export function TerminalIcon(props: IconProps) {
  return <LegacyIcon iconName="TerminalIcon" {...props} />
}

export function SearchIcon(props: IconProps) {
  return <LegacyIcon iconName="SearchIcon" {...props} />
}

export function PlusIcon(props: IconProps) {
  return <LegacyIcon iconName="PlusIcon" {...props} />
}

export function CloseIcon(props: IconProps) {
  return <LegacyIcon iconName="CloseIcon" {...props} />
}

export function MinimizeIcon(props: IconProps) {
  return <LegacyIcon iconName="MinimizeIcon" {...props} />
}

export function MaximizeIcon(props: IconProps) {
  return <LegacyIcon iconName="MaximizeIcon" {...props} />
}

export function MenuIcon(props: IconProps) {
  return <LegacyIcon iconName="MenuIcon" {...props} />
}

export function WrenchIcon(props: IconProps) {
  return <LegacyIcon iconName="WrenchIcon" {...props} />
}

export function ChevronDownIcon(props: IconProps) {
  return <LegacyIcon iconName="ChevronDownIcon" {...props} />
}

export function ChevronRightIcon(props: IconProps) {
  return <LegacyIcon iconName="ChevronRightIcon" {...props} />
}

export function ChevronLeftIcon(props: IconProps) {
  return <LegacyIcon iconName="ChevronLeftIcon" {...props} />
}

export function CopyIcon(props: IconProps) {
  return <LegacyIcon iconName="CopyIcon" {...props} />
}

export function TrashIcon(props: IconProps) {
  return <LegacyIcon iconName="TrashIcon" {...props} />
}

export function ExternalLinkIcon(props: IconProps) {
  return <LegacyIcon iconName="ExternalLinkIcon" {...props} />
}

export function RefreshIcon(props: IconProps) {
  return <LegacyIcon iconName="RefreshIcon" {...props} />
}

export function FilterIcon(props: IconProps) {
  return <LegacyIcon iconName="FilterIcon" {...props} />
}

export function WindowIcon(props: IconProps) {
  return <LegacyIcon iconName="WindowIcon" {...props} />
}

export function PortIcon(props: IconProps) {
  return <LegacyIcon iconName="PortIcon" {...props} />
}

export function ProcessIcon(props: IconProps) {
  return <LegacyIcon iconName="ProcessIcon" {...props} />
}

export function AIIcon(props: IconProps) {
  return <LegacyIcon iconName="AIIcon" {...props} />
}

export function GridIcon(props: IconProps) {
  return <LegacyIcon iconName="GridIcon" {...props} />
}

export function ListIcon(props: IconProps) {
  return <LegacyIcon iconName="ListIcon" {...props} />
}

export function AlertIcon(props: IconProps) {
  return <LegacyIcon iconName="AlertIcon" {...props} />
}

export function CheckIcon(props: IconProps) {
  return <LegacyIcon iconName="CheckIcon" {...props} />
}

export function InfoIcon(props: IconProps) {
  return <LegacyIcon iconName="InfoIcon" {...props} />
}

export function KillIcon(props: IconProps) {
  return <LegacyIcon iconName="KillIcon" {...props} />
}

export function EyeIcon(props: IconProps) {
  return <LegacyIcon iconName="EyeIcon" {...props} />
}

export function ChevronIcon(props: IconProps) {
  return <LegacyIcon iconName="ChevronIcon" {...props} />
}

export function CodeIcon(props: IconProps) {
  return <LegacyIcon iconName="CodeIcon" {...props} />
}

export function GlobeIcon(props: IconProps) {
  return <LegacyIcon iconName="GlobeIcon" {...props} />
}

export function TreeIcon(props: IconProps) {
  return <LegacyIcon iconName="TreeIcon" {...props} />
}

export function NetworkIcon(props: IconProps) {
  return <LegacyIcon iconName="NetworkIcon" {...props} />
}

export function TopologyIcon(props: IconProps) {
  return <LegacyIcon iconName="TopologyIcon" {...props} />
}

export function PaletteIcon(props: IconProps) {
  return <LegacyIcon iconName="PaletteIcon" {...props} />
}

export function ScanIcon(props: IconProps) {
  return <LegacyIcon iconName="ScanIcon" {...props} />
}

export function BellIcon(props: IconProps) {
  return <LegacyIcon iconName="BellIcon" {...props} />
}

export function LayoutIcon(props: IconProps) {
  return <LegacyIcon iconName="LayoutIcon" {...props} />
}

export function DownloadIcon(props: IconProps) {
  return <LegacyIcon iconName="DownloadIcon" {...props} />
}

export function UploadIcon(props: IconProps) {
  return <LegacyIcon iconName="UploadIcon" {...props} />
}

export function GitBranchIcon(props: IconProps) {
  return <LegacyIcon iconName="GitBranchIcon" {...props} />
}

export function PackageIcon(props: IconProps) {
  return <LegacyIcon iconName="PackageIcon" {...props} />
}

export function ClockIcon(props: IconProps) {
  return <LegacyIcon iconName="ClockIcon" {...props} />
}

export function SortIcon(props: IconProps) {
  return <LegacyIcon iconName="SortIcon" {...props} />
}

export function ChevronUpIcon(props: IconProps) {
  return <LegacyIcon iconName="ChevronUpIcon" {...props} />
}

export function SettingsIcon(props: IconProps) {
  return <LegacyIcon iconName="SettingsIcon" {...props} />
}
