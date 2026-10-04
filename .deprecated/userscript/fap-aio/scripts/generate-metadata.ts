/**
 * Metadata Block Generator for FAP-AIO Userscript
 * Generates the userscript metadata block with all required directives
 */

export interface UserscriptMetadata {
  name: string;
  namespace: string;
  version: string;
  description: string;
  author: string;
  match: string[];
  grant: string[];
  require: string[];
  connect: string[];
  runAt: 'document-start' | 'document-end' | 'document-idle';
  updateURL?: string;
  downloadURL?: string;
  homepageURL?: string;
  icon?: string;
}

/**
 * Generates the userscript metadata block
 */
export function generateMetadataBlock(metadata: UserscriptMetadata): string {
  const lines: string[] = [
    '// ==UserScript==',
    `// @name         ${metadata.name}`,
    `// @namespace    ${metadata.namespace}`,
    `// @version      ${metadata.version}`,
    `// @description  ${metadata.description}`,
    `// @author       ${metadata.author}`,
    ...metadata.match.map(m => `// @match        ${m}`),
    ...metadata.grant.map(g => `// @grant        ${g}`),
    ...metadata.require.map(r => `// @require      ${r}`),
    ...metadata.connect.map(c => `// @connect      ${c}`),
    `// @run-at       ${metadata.runAt}`,
  ];

  if (metadata.updateURL) {
    lines.push(`// @updateURL    ${metadata.updateURL}`);
  }

  if (metadata.downloadURL) {
    lines.push(`// @downloadURL  ${metadata.downloadURL}`);
  }

  if (metadata.homepageURL) {
    lines.push(`// @homepageURL  ${metadata.homepageURL}`);
  }

  if (metadata.icon) {
    lines.push(`// @icon         ${metadata.icon}`);
  }

  lines.push('// ==/UserScript==');
  lines.push(''); // Empty line after metadata block

  return lines.join('\n');
}

/**
 * Default metadata configuration for FAP-AIO
 */
export function getDefaultMetadata(version: string, faviconBase64?: string): UserscriptMetadata {
  return {
    name: 'FAP-AIO',
    namespace: 'https://github.com/ruskicoder/fap-aio',
    version: version,
    description: 'All-in-One Enhancement for FPT University Academic Portal',
    author: 'ruskicoder',
    match: ['https://fap.fpt.edu.vn/*'],
    grant: [
      'GM_setValue',
      'GM_getValue',
      'GM_deleteValue',
      'GM_addStyle',
      'GM_xmlhttpRequest',
      'GM_info',
    ],
    require: [
      // Major version lock (@18) for security + compatibility
      'https://unpkg.com/react@18/umd/react.production.min.js',
      'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    ],
    connect: [
      'fap.fpt.edu.vn',
      'ruskicoder.github.io',
    ],
    runAt: 'document-start',
    updateURL: 'https://ruskicoder.github.io/fap-aio/fap-aio.user.js',
    downloadURL: 'https://ruskicoder.github.io/fap-aio/fap-aio.user.js',
    homepageURL: 'https://github.com/ruskicoder/fap-aio',
    icon: faviconBase64 || 'https://fptshop.com.vn/favicon.ico',
  };
}
