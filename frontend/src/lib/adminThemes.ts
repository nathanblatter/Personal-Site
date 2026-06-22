import { useCallback, useState } from 'react'

// Admin-only theming. Each theme overrides the same Tailwind color tokens used
// across the admin UI; applied as inline CSS variables on the admin root so it
// never leaks to the public site. Persisted in localStorage.

export interface AdminTheme {
  id: string
  name: string
  /** Representative colors for the picker chip: [background, accent]. */
  swatch: [string, string]
  vars: Record<string, string>
}

// Helper to keep each palette declaration to a single readable line.
function palette(
  white: string, snow: string, cloud: string, mist: string,
  silver: string, steel: string, slate: string, ink: string,
  blue: string, blueLight: string, blueDim: string, blueWash: string,
  teal: string, ember: string,
): Record<string, string> {
  return {
    '--color-white': white, '--color-snow': snow, '--color-cloud': cloud, '--color-mist': mist,
    '--color-silver': silver, '--color-steel': steel, '--color-slate': slate, '--color-ink': ink,
    '--color-blue': blue, '--color-blue-light': blueLight, '--color-blue-dim': blueDim,
    '--color-blue-wash': blueWash, '--color-teal': teal, '--color-ember': ember,
  }
}

export const ADMIN_THEMES: AdminTheme[] = [
  {
    id: 'light', name: 'Light', swatch: ['#ffffff', '#3b6cf5'],
    vars: palette('#ffffff', '#fafbfc', '#f1f4f8', '#e4e9f0', '#c8d0db', '#8c95a6', '#5a6478', '#2d3342', '#3b6cf5', '#5b8af7', '#2a54d4', '#eef3ff', '#38b2ac', '#e25555'),
  },
  {
    id: 'dark', name: 'Dark', swatch: ['#0d1117', '#3b6cf5'],
    vars: palette('#161b22', '#0d1117', '#1c2128', '#30363d', '#484f58', '#8b949e', '#b1bac4', '#e6edf3', '#3b6cf5', '#5b8af7', '#2a54d4', '#162032', '#2ea043', '#f85149'),
  },
  {
    id: 'midnight', name: 'Midnight', swatch: ['#0f1424', '#6d8bff'],
    vars: palette('#161d33', '#0c1120', '#0f1424', '#283250', '#4a5578', '#8893b5', '#b9c2e0', '#eef1fb', '#6d8bff', '#93a8ff', '#4f6fe6', '#1c2748', '#46c4b0', '#ff6b7d'),
  },
  {
    id: 'dracula', name: 'Dracula', swatch: ['#282a36', '#bd93f9'],
    vars: palette('#2b2e3b', '#21222c', '#282a36', '#44475a', '#5c6178', '#9aa0bd', '#c6cae6', '#f8f8f2', '#bd93f9', '#d0acff', '#9d6fe0', '#343746', '#50fa7b', '#ff5555'),
  },
  {
    id: 'nord', name: 'Nord', swatch: ['#2e3440', '#88c0d0'],
    vars: palette('#3b4252', '#2b303b', '#2e3440', '#434c5e', '#58616f', '#8d97a8', '#d8dee9', '#eceff4', '#88c0d0', '#a3d4e0', '#5e9bb0', '#3b4859', '#a3be8c', '#bf616a'),
  },
  {
    id: 'solarized', name: 'Solarized', swatch: ['#002b36', '#268bd2'],
    vars: palette('#073642', '#00252e', '#002b36', '#0a4a59', '#2a6b78', '#839496', '#93a1a1', '#fdf6e3', '#268bd2', '#4aa3df', '#1f6fa8', '#08313c', '#859900', '#dc322f'),
  },
  {
    id: 'forest', name: 'Forest', swatch: ['#0f1a13', '#3fb968'],
    vars: palette('#14241a', '#0c160f', '#0f1a13', '#234231', '#3c6b4f', '#7fa98c', '#c2dccb', '#eef6f0', '#3fb968', '#5fd185', '#2f9b52', '#15281c', '#4cc38a', '#e2685f'),
  },
  {
    id: 'rose', name: 'Rosé', swatch: ['#191724', '#c4a7e7'],
    vars: palette('#1f1d2e', '#16141f', '#191724', '#403d52', '#56526e', '#6e6a86', '#908caa', '#e0def4', '#c4a7e7', '#d7c4f0', '#a98fd0', '#2a2740', '#9ccfd8', '#eb6f92'),
  },
  {
    id: 'sunset', name: 'Sunset', swatch: ['#fdf6ef', '#e07a3f'],
    vars: palette('#fffdfa', '#fbf2e8', '#fdf6ef', '#efe0d2', '#d8c3ad', '#a3826a', '#6f5544', '#3a2a20', '#e07a3f', '#ef9460', '#c5612b', '#fdeada', '#5a9e8f', '#d2483b'),
  },
  {
    id: 'mono', name: 'Mono', swatch: ['#f4f4f5', '#3f3f46'],
    vars: palette('#ffffff', '#fafafa', '#f4f4f5', '#e4e4e7', '#c0c0c6', '#82828c', '#52525b', '#1f1f23', '#3f3f46', '#5b5b63', '#27272a', '#ededf0', '#5f8c84', '#b45454'),
  },
  {
    id: 'ocean', name: 'Ocean', swatch: ['#07181f', '#22c3d6'],
    vars: palette('#0c232d', '#06141a', '#07181f', '#154654', '#2d6675', '#6fa3b0', '#bfe0e7', '#ecf7fa', '#22c3d6', '#4ad6e6', '#149bad', '#0d2b34', '#2dd4bf', '#f87171'),
  },
  {
    id: 'crimson', name: 'Crimson', swatch: ['#1a0f12', '#f0526a'],
    vars: palette('#251418', '#170c0f', '#1a0f12', '#46232b', '#6e3742', '#b08089', '#e2c2c7', '#faf0f1', '#f0526a', '#ff7588', '#cf3a52', '#2e151a', '#4cc38a', '#ff5d5d'),
  },
]

export const DEFAULT_ADMIN_THEME = 'light'
const STORAGE_KEY = 'admin-theme'

export function useAdminTheme() {
  const [themeId, setThemeId] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_ADMIN_THEME } catch { return DEFAULT_ADMIN_THEME }
  })
  const setTheme = useCallback((id: string) => {
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }
    setThemeId(id)
  }, [])
  const theme = ADMIN_THEMES.find(t => t.id === themeId) ?? ADMIN_THEMES[0]
  return { themeId, theme, setTheme }
}
