import * as Icons from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

export function getIcon(name: string): LucideIcon {
  const icon = (Icons as Record<string, unknown>)[name]
  if (typeof icon === 'function') return icon as LucideIcon
  return Icons.ExternalLink
}
