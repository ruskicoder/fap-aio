// Keeps FAP's `data-bs-theme` on the theme's mode while a theme is active (R1.3), and restores FAP's
// own value under FAP default (R1.4). Jidox sets the attribute from its own script, which may run
// after us, so a MutationObserver re-asserts the forced mode and remembers what FAP last chose.
const ATTR = 'data-bs-theme'

export class ModeGuard {
  private forced: 'light' | 'dark' | null = null
  private fapMode: string | null
  private observer: MutationObserver | null = null

  constructor(private readonly root: HTMLElement = document.documentElement) {
    this.fapMode = root.getAttribute(ATTR)
  }

  /** FAP's own mode as last set by the page (null when FAP never set one). */
  get saved(): string | null {
    return this.fapMode
  }

  force(mode: 'light' | 'dark'): void {
    this.forced = mode
    if (!this.observer) {
      this.observer = new MutationObserver(() => this.onChange())
      this.observer.observe(this.root, { attributes: true, attributeFilter: [ATTR] })
    }
    if (this.root.getAttribute(ATTR) !== mode) this.root.setAttribute(ATTR, mode)
  }

  /** Stops forcing and puts back FAP's own value. */
  restore(): void {
    if (this.forced === null) return
    this.forced = null
    this.observer?.disconnect()
    this.observer = null
    if (this.fapMode === null) this.root.removeAttribute(ATTR)
    else this.root.setAttribute(ATTR, this.fapMode)
  }

  private onChange(): void {
    const now = this.root.getAttribute(ATTR)
    if (this.forced === null || now === this.forced) return
    this.fapMode = now
    this.root.setAttribute(ATTR, this.forced)
  }
}
