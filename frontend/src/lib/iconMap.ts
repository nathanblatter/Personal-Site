// Curated icon registry. Importing named icons (instead of `import * as Icons`)
// lets Rollup tree-shake lucide-react — the wildcard import previously pulled in
// the entire icon set (~600KB). Admin-selectable icons must be listed here;
// unknown names fall back to ExternalLink.
import {
  type LucideIcon,
  ExternalLink,
  // Skills / tech
  BarChart3, Brain, Code2, Database, Server, Globe, Cpu, Cloud, Terminal,
  Laptop, Wrench, Hammer, GitBranch,
  // Socials / contact
  Github, Linkedin, Mail, Twitter, Instagram, Youtube, Send, MessageCircle,
  Phone, MapPin, Link as LinkIcon, AtSign, Rss,
  // Interests / about / facts
  BookOpen, Coffee, Compass, Gamepad2, Music, Camera, Dumbbell, Heart,
  Rocket, Target, Sparkles, Star, Award, Users, Briefcase, GraduationCap,
  Calendar, Zap, FileText, Lightbulb, Mountain, Plane, Palette, Trophy,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  BarChart3, Brain, Code2, Database, Server, Globe, Cpu, Cloud, Terminal,
  Laptop, Wrench, Hammer, GitBranch,
  Github, Linkedin, Mail, Twitter, Instagram, Youtube, Send, MessageCircle,
  Phone, MapPin, Link: LinkIcon, AtSign, Rss,
  BookOpen, Coffee, Compass, Gamepad2, Music, Camera, Dumbbell, Heart,
  Rocket, Target, Sparkles, Star, Award, Users, Briefcase, GraduationCap,
  Calendar, Zap, FileText, Lightbulb, Mountain, Plane, Palette, Trophy,
  ExternalLink,
}

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? ExternalLink
}
