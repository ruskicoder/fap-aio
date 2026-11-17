// The `--ct-*` custom properties FAP's stylesheet defines at its root and dark rules (appearance design,
// "Role to variable map"). FAP uses the Jidox template, which is Bootstrap 5.3 with `--bs-` renamed to
// `--ct-`: the first list is Bootstrap 5.3.3's `:root` and `[data-bs-theme=dark]` set, renamed; the second
// holds the Jidox menu and top bar names. The recorded count on FAP was 144 (docs investigation of
// 2026-10-04); the list is confirmed against FAP's app.min.css at UAT (vet list), and a name added then
// must be mapped or left alone, which the role map test enforces.

export const BOOTSTRAP_VARS = [
  '--ct-black', '--ct-black-rgb', '--ct-blue', '--ct-body-bg', '--ct-body-bg-rgb', '--ct-body-color', '--ct-body-color-rgb',
  '--ct-body-font-family', '--ct-body-font-size', '--ct-body-font-weight', '--ct-body-line-height', '--ct-border-color',
  '--ct-border-color-translucent', '--ct-border-radius', '--ct-border-radius-2xl', '--ct-border-radius-lg',
  '--ct-border-radius-pill', '--ct-border-radius-sm', '--ct-border-radius-xl', '--ct-border-radius-xxl',
  '--ct-border-style', '--ct-border-width', '--ct-box-shadow', '--ct-box-shadow-inset', '--ct-box-shadow-lg',
  '--ct-box-shadow-sm', '--ct-code-color', '--ct-cyan', '--ct-danger', '--ct-danger-bg-subtle', '--ct-danger-border-subtle',
  '--ct-danger-rgb', '--ct-danger-text-emphasis', '--ct-dark', '--ct-dark-bg-subtle', '--ct-dark-border-subtle',
  '--ct-dark-rgb', '--ct-dark-text-emphasis', '--ct-emphasis-color', '--ct-emphasis-color-rgb', '--ct-focus-ring-color',
  '--ct-focus-ring-opacity', '--ct-focus-ring-width', '--ct-font-monospace', '--ct-font-sans-serif', '--ct-form-invalid-border-color',
  '--ct-form-invalid-color', '--ct-form-valid-border-color', '--ct-form-valid-color', '--ct-gradient', '--ct-gray',
  '--ct-gray-100', '--ct-gray-200', '--ct-gray-300', '--ct-gray-400', '--ct-gray-500', '--ct-gray-600', '--ct-gray-700',
  '--ct-gray-800', '--ct-gray-900', '--ct-gray-dark', '--ct-green', '--ct-heading-color', '--ct-highlight-bg',
  '--ct-highlight-color', '--ct-indigo', '--ct-info', '--ct-info-bg-subtle', '--ct-info-border-subtle', '--ct-info-rgb',
  '--ct-info-text-emphasis', '--ct-light', '--ct-light-bg-subtle', '--ct-light-border-subtle', '--ct-light-rgb',
  '--ct-light-text-emphasis', '--ct-link-color', '--ct-link-color-rgb', '--ct-link-decoration', '--ct-link-hover-color',
  '--ct-link-hover-color-rgb', '--ct-orange', '--ct-pink', '--ct-primary', '--ct-primary-bg-subtle', '--ct-primary-border-subtle',
  '--ct-primary-rgb', '--ct-primary-text-emphasis', '--ct-purple', '--ct-red', '--ct-secondary', '--ct-secondary-bg',
  '--ct-secondary-bg-rgb', '--ct-secondary-bg-subtle', '--ct-secondary-border-subtle', '--ct-secondary-color',
  '--ct-secondary-color-rgb', '--ct-secondary-rgb', '--ct-secondary-text-emphasis', '--ct-success', '--ct-success-bg-subtle',
  '--ct-success-border-subtle', '--ct-success-rgb', '--ct-success-text-emphasis', '--ct-teal', '--ct-tertiary-bg',
  '--ct-tertiary-bg-rgb', '--ct-tertiary-color', '--ct-tertiary-color-rgb', '--ct-warning', '--ct-warning-bg-subtle',
  '--ct-warning-border-subtle', '--ct-warning-rgb', '--ct-warning-text-emphasis', '--ct-white', '--ct-white-rgb',
  '--ct-yellow',
] as const

/** Jidox menu and top bar variables (not confirmed on FAP yet). */
export const JIDOX_VARS = [
  '--ct-menu-bg', '--ct-menu-item-color', '--ct-menu-item-hover-color', '--ct-menu-item-active-color', '--ct-help-box-bg',
  '--ct-topbar-bg', '--ct-topbar-item-color', '--ct-topbar-item-hover-color', '--ct-topbar-search-bg', '--ct-topbar-user-bg',
  '--ct-topbar-user-border',
] as const

export const CT_VARS: readonly string[] = [...BOOTSTRAP_VARS, ...JIDOX_VARS]
