// Structural page guard (core R1.1, R1.7): the panel mounts only on authenticated FAP v2
// pages, detected by the Jidox layout root, never on the login page or a 404 page.

export function isLoginPage(doc: Document): boolean {
  return !!doc.querySelector('form[action^="/Auth/Login"], #frm-parent-login, input[type="password"]')
}

export function isAuthenticatedPage(doc: Document): boolean {
  if (isLoginPage(doc)) return false
  return !!doc.querySelector('.wrapper .content-page')
}
