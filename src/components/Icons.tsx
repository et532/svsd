type IconProps = { size?: number }

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function MindmapIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="M6.6 6.4 10.3 10.4M17.2 6.9 13.9 10.6M10.4 13.6 7.4 17.6M13.8 13.4 16.6 17.5" />
    </svg>
  )
}

export function ListIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

export function GlobeIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
    </svg>
  )
}

export function PlusIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.4} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function SearchIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      {/* Slightly smaller lens and longer handle, within the same 4–20 bounds as before */}
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15 15l5 5" />
    </svg>
  )
}

export function CloseIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function PinIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  )
}

export function TagIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="8.5" r="1.3" />
    </svg>
  )
}

// Where they're from: roots
export function SproutIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 2.5-6.5 7-6.5 0 4.5-2.5 6.5-7 6.5Z" />
      <path d="M12 14.5C12 11 10 9 5.5 9c0 3.8 2 5.5 6.5 5.5Z" />
    </svg>
  )
}

// Where you met
export function MeetIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <circle cx="8" cy="7.5" r="3" />
      <circle cx="16.5" cy="8.5" r="2.5" />
      <path d="M2.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" />
      <path d="M14.5 14.3c.6-.2 1.3-.3 2-.3 2.6 0 5 2 5 5.5" />
    </svg>
  )
}

// Where they live now
export function HomeIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20H4v-9.5Z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}


export function MicIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

export function KeyboardIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </svg>
  )
}

export function CheckIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.4} aria-hidden>
      <path d="M5 12l5 5 9-10" />
    </svg>
  )
}

export function PauseIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={2.4} aria-hidden>
      <path d="M9 6v12M15 6v12" />
    </svg>
  )
}

export function PlayIcon({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M7 4l13 8-13 8z" fill="currentColor" />
    </svg>
  )
}

export function BackIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
