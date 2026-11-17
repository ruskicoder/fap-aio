// The eleven presets (appearance R2.1 to R2.4; design, presets table). Each is a Theme with explicit roles
// and tokens plus generated effects. `backdrop` records what shows through translucent surfaces, so the
// contrast test can check text against the colour a student actually sees (R2.4).
import type { Roles } from '../color/roles'
import { effectsCss, type Look } from './effects'
import type { Theme } from './model'

export interface Preset {
  theme: Theme
  /** Colours behind the translucent surfaces and the surface tint and opacity laid over them. */
  backdrop: { colors: string[]; tint: string; alpha: number } | null
  look: Look
}

const LIGHT_STATUS = { success: '#15803d', warning: '#b45309', danger: '#b91c1c', info: '#0369a1' }
const DARK_STATUS = { success: '#4ade80', warning: '#fbbf24', danger: '#f87171', info: '#38bdf8' }

function preset(id: string, name: string, mode: 'light' | 'dark', roles: Omit<Roles, keyof typeof LIGHT_STATUS> & Partial<Roles>, tokens: Theme['tokens'], look: Look, backdrop: Preset['backdrop']): Preset {
  const status = mode === 'light' ? LIGHT_STATUS : DARK_STATUS
  return {
    theme: { formatVersion: 1, id, name, mode, roles: { ...status, ...roles } as Roles, vars: {}, tokens, effects: effectsCss(look), background: null, css: '', preset: id },
    backdrop,
    look,
  }
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export const PRESETS: readonly Preset[] = [
  preset('glassmorphism', 'Glassmorphism', 'light',
    { primary: '#6d28d9', secondary: '#0e7490', accent: '#be185d', surface: '#ffffff', surfaceAlt: '#f5f3ff', text: '#1e1b2e', textMuted: '#4a4560', border: '#e4defa' },
    { radius: 16, shadow: 'soft', blur: 14, surfaceOpacity: 0.55, fontFamily: FONT },
    { body: 'linear-gradient(135deg, #a78bfa 0%, #67e8f9 50%, #f9a8d4 100%)', surface: 'rgba(255, 255, 255, 0.55)', edge: '1px solid rgba(255, 255, 255, 0.5)',
      shadow: '0 8px 32px rgba(31, 27, 46, 0.12)', radius: 16, blur: 14, saturate: 160, chrome: 'rgba(255, 255, 255, 0.45)', inputBorder: '#655c82' },
    { colors: ['#a78bfa', '#67e8f9', '#f9a8d4'], tint: '#ffffff', alpha: 0.55 }),
  preset('neumorphism', 'Neumorphism', 'light',
    { primary: '#3b5bdb', secondary: '#5f6b7a', accent: '#c2255c', surface: '#e8ecf1', surfaceAlt: '#e8ecf1', text: '#232a35', textMuted: '#4b5563', border: '#d5dbe3' },
    { radius: 16, shadow: 'dual', blur: 0, surfaceOpacity: 1, fontFamily: FONT },
    { body: '#e8ecf1', surface: '#e8ecf1', edge: '0 solid transparent', shadow: '8px 8px 16px #c5c9cf, -8px -8px 16px #ffffff', radius: 16, chrome: '#e8ecf1', inputBorder: '#7d8794',
      button: 'box-shadow: 5px 5px 10px #c5c9cf, -5px -5px 10px #ffffff; border: 0;', pressed: 'inset 4px 4px 8px #c5c9cf, inset -4px -4px 8px #ffffff' },
    null),
  preset('minimalist-white', 'Minimalist White', 'light',
    { primary: '#1d4ed8', secondary: '#4b5563', accent: '#1d4ed8', surface: '#ffffff', surfaceAlt: '#fafafa', text: '#111111', textMuted: '#555555', border: '#ececec' },
    { radius: 6, shadow: 'none', blur: 0, surfaceOpacity: 1, fontFamily: FONT },
    { body: '#ffffff', surface: '#ffffff', edge: '1px solid #ececec', shadow: 'none', radius: 6, chrome: '#ffffff', inputBorder: '#8a8a8a',
      extra: 'html[data-bs-theme] .card-body { padding: 1.5rem; }' },
    null),
  preset('frutiger-aero-green', 'Frutiger Aero Green', 'light',
    { primary: '#1f7a33', secondary: '#0369a1', accent: '#0e7490', surface: '#ffffff', surfaceAlt: '#effaf2', text: '#0f2a1a', textMuted: '#355441', border: '#cfe9d6' },
    { radius: 12, shadow: 'soft', blur: 8, surfaceOpacity: 0.72, fontFamily: FONT },
    { body: 'linear-gradient(180deg, #bfe6ff 0%, #d8f3c9 55%, #b6f0a8 100%)', surface: 'rgba(255, 255, 255, 0.72)', edge: '1px solid rgba(255, 255, 255, 0.8)',
      shadow: '0 6px 20px rgba(15, 42, 26, 0.12)', radius: 12, blur: 8, saturate: 140, chrome: 'rgba(255, 255, 255, 0.6)', inputBorder: '#5f8a6c',
      button: 'background-image: linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0) 55%);' },
    { colors: ['#bfe6ff', '#d8f3c9', '#b6f0a8'], tint: '#ffffff', alpha: 0.72 }),
  preset('frutiger-aero-blue', 'Frutiger Aero Blue', 'light',
    { primary: '#075985', secondary: '#0f766e', accent: '#1d4ed8', surface: '#ffffff', surfaceAlt: '#eef8ff', text: '#0b2440', textMuted: '#33506e', border: '#cde6f7' },
    { radius: 12, shadow: 'soft', blur: 8, surfaceOpacity: 0.72, fontFamily: FONT },
    { body: 'linear-gradient(180deg, #d9f2ff 0%, #a9dcff 60%, #7cc8ff 100%)', surface: 'rgba(255, 255, 255, 0.72)', edge: '1px solid rgba(255, 255, 255, 0.8)',
      shadow: '0 6px 20px rgba(11, 36, 64, 0.14)', radius: 12, blur: 8, saturate: 140, chrome: 'rgba(255, 255, 255, 0.6)', inputBorder: '#5b7a99',
      button: 'background-image: linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0) 55%);',
      extra: 'html[data-bs-theme] body { background-image: radial-gradient(circle at 15% 85%, rgba(255, 255, 255, 0.5) 0 60px, transparent 61px), radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.35) 0 40px, transparent 41px), linear-gradient(180deg, #d9f2ff 0%, #a9dcff 60%, #7cc8ff 100%); }' },
    { colors: ['#d9f2ff', '#a9dcff', '#7cc8ff'], tint: '#ffffff', alpha: 0.72 }),
  preset('liquid-glass', 'Liquid Glass', 'light',
    { primary: '#4338ca', secondary: '#0f766e', accent: '#be185d', surface: '#ffffff', surfaceAlt: '#f3f4ff', text: '#1a1c2e', textMuted: '#474a63', border: '#e0e2f5' },
    { radius: 20, shadow: 'soft', blur: 20, surfaceOpacity: 0.6, fontFamily: FONT },
    { body: 'linear-gradient(135deg, #e0e7ff 0%, #fce7f3 50%, #e0f2fe 100%)', surface: 'rgba(255, 255, 255, 0.6)',
      edge: '1px solid rgba(255, 255, 255, 0.7)', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.53), inset 0 -8px 16px rgba(67, 56, 202, 0.06), 0 10px 30px rgba(26, 28, 46, 0.1)',
      radius: 20, blur: 20, saturate: 180, chrome: 'rgba(255, 255, 255, 0.5)', inputBorder: '#757896' },
    { colors: ['#e0e7ff', '#fce7f3', '#e0f2fe'], tint: '#ffffff', alpha: 0.6 }),
  preset('claymorphism', 'Claymorphism', 'light',
    { primary: '#7e22ce', secondary: '#0e7490', accent: '#c2410c', surface: '#fff7fb', surfaceAlt: '#f3e8ff', text: '#2b1838', textMuted: '#57446a', border: '#ead8f5' },
    { radius: 24, shadow: 'clay', blur: 0, surfaceOpacity: 1, fontFamily: FONT },
    { body: '#f3e8ff', surface: '#fff7fb', edge: '0 solid transparent',
      shadow: 'inset -6px -6px 12px rgba(0, 0, 0, 0.1), inset 6px 6px 12px rgba(255, 255, 255, 0.7), 10px 14px 24px rgba(0, 0, 0, 0.12)', radius: 24, chrome: '#fff7fb', inputBorder: '#8c7a9c',
      button: 'box-shadow: inset -3px -3px 6px rgba(0, 0, 0, 0.12), inset 3px 3px 6px rgba(255, 255, 255, 0.6), 4px 6px 12px rgba(0, 0, 0, 0.12); border: 0;',
      pressed: 'inset 4px 4px 8px rgba(0, 0, 0, 0.15), inset -4px -4px 8px rgba(255, 255, 255, 0.6)' },
    null),
  preset('glassmorphism-dark', 'Glassmorphism Dark', 'dark',
    { primary: '#a78bfa', secondary: '#67e8f9', accent: '#f9a8d4', surface: '#000000', surfaceAlt: '#0f0f12', text: '#f4f4f6', textMuted: '#a7a7b3', border: '#26262c' },
    { radius: 16, shadow: 'soft', blur: 14, surfaceOpacity: 0.06, fontFamily: FONT },
    { body: '#000000', surface: 'rgba(255, 255, 255, 0.06)', edge: '1px solid rgba(255, 255, 255, 0.12)', shadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      radius: 16, blur: 14, saturate: 140, chrome: 'rgba(255, 255, 255, 0.04)', inputBorder: '#8b8b99',
      extra: 'html[data-bs-theme] body { background-image: radial-gradient(circle at 20% 10%, rgba(167, 139, 250, 0.18), transparent 40%), radial-gradient(circle at 85% 80%, rgba(103, 232, 249, 0.12), transparent 40%); }' },
    { colors: ['#000000', '#1e1930', '#0d2226'], tint: '#ffffff', alpha: 0.06 }),
  preset('minimalist-black', 'Minimalist Black', 'dark',
    { primary: '#60a5fa', secondary: '#a3a3a3', accent: '#60a5fa', surface: '#000000', surfaceAlt: '#0a0a0a', text: '#ededed', textMuted: '#a3a3a3', border: '#1f1f1f' },
    { radius: 6, shadow: 'none', blur: 0, surfaceOpacity: 1, fontFamily: FONT },
    { body: '#000000', surface: '#000000', edge: '1px solid #1f1f1f', shadow: 'none', radius: 6, chrome: '#000000', inputBorder: '#6e6e6e',
      extra: 'html[data-bs-theme] .card-body { padding: 1.5rem; }' },
    null),
  preset('liquid-glass-dark', 'Liquid Glass Dark', 'dark',
    { primary: '#818cf8', secondary: '#5eead4', accent: '#f472b6', surface: '#000000', surfaceAlt: '#111114', text: '#f5f5f7', textMuted: '#a8a8b8', border: '#2a2a30' },
    { radius: 20, shadow: 'soft', blur: 20, surfaceOpacity: 0.08, fontFamily: FONT },
    { body: '#000000', surface: 'rgba(255, 255, 255, 0.08)', edge: '1px solid rgba(255, 255, 255, 0.14)',
      shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -8px 16px rgba(129, 140, 248, 0.08), 0 10px 30px rgba(0, 0, 0, 0.7)',
      radius: 20, blur: 20, saturate: 180, chrome: 'rgba(255, 255, 255, 0.05)', inputBorder: '#8a8a9c',
      extra: 'html[data-bs-theme] body { background-image: radial-gradient(circle at 70% 15%, rgba(129, 140, 248, 0.16), transparent 45%); }' },
    { colors: ['#000000', '#15162a'], tint: '#ffffff', alpha: 0.08 }),
  preset('claymorphism-vibrant-dark', 'Claymorphism Vibrant Dark', 'dark',
    { primary: '#f472b6', secondary: '#a78bfa', accent: '#facc15', surface: '#000000', surfaceAlt: '#1a0f24', text: '#fdf4ff', textMuted: '#c9b6d6', border: '#2e1c3d' },
    { radius: 24, shadow: 'clay', blur: 0, surfaceOpacity: 1, fontFamily: FONT },
    { body: '#000000', surface: '#1a0f24', edge: '0 solid transparent',
      shadow: 'inset -6px -6px 12px rgba(0, 0, 0, 0.45), inset 6px 6px 12px rgba(244, 114, 182, 0.12), 10px 14px 24px rgba(0, 0, 0, 0.6)', radius: 24, chrome: '#12091a', inputBorder: '#8a6f9c',
      button: 'box-shadow: inset -3px -3px 6px rgba(0, 0, 0, 0.35), inset 3px 3px 6px rgba(255, 255, 255, 0.15), 4px 6px 12px rgba(0, 0, 0, 0.5); border: 0;',
      pressed: 'inset 4px 4px 8px rgba(0, 0, 0, 0.5), inset -4px -4px 8px rgba(255, 255, 255, 0.08)' },
    null),
]

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.theme.id === id)
