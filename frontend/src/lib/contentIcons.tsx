import {
  Hammer, BookOpen, Compass, Coffee, Laptop, Code2, Server, Wrench,
  Sparkles, Rocket, Target, Heart, Music, Dumbbell, Camera, Globe,
  Database, Cloud, Terminal, Cpu, type LucideIcon,
} from 'lucide-react'

// Names referenced by editable site content (/now, /uses). The string is what
// gets stored in the DB; the admin editor offers these as icon options.
export const CONTENT_ICONS: Record<string, LucideIcon> = {
  Hammer, BookOpen, Compass, Coffee, Laptop, Code2, Server, Wrench,
  Sparkles, Rocket, Target, Heart, Music, Dumbbell, Camera, Globe,
  Database, Cloud, Terminal, Cpu,
}

export const CONTENT_ICON_OPTIONS = Object.keys(CONTENT_ICONS).map(name => ({
  value: name,
  label: name,
}))

/** Resolve an icon name to a component, falling back to Sparkles. */
export function contentIcon(name: string | undefined): LucideIcon {
  return (name && CONTENT_ICONS[name]) || Sparkles
}
