import { simpleHash, minifyCss } from './minify';

const rawStyles = `
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
.job-row-header:hover { background-color: #fef3ec; }
.job-row-header { transition: background-color 0.15s ease; }
.job-row.expanded .job-row-header { background-color: #fef3ec; }
.job-row.visited .job-row-header { background-color: #fef3ec; }
.tag-pill { display: inline-block; padding: 0.125rem 0.5rem; font-size: 0.75rem; line-height: 1rem; border-radius: 0.25rem; }
`;

export const appStyles = minifyCss(rawStyles);

const appStylesContentHash = simpleHash(appStyles);

export const appStylesAssetFilename = `app.${appStylesContentHash}.css`;
