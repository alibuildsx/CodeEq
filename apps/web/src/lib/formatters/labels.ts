export function formatFramework(framework?: string): string {
  switch (framework) {
    case 'nextjs':
      return 'Next.js';
    case 'vite':
      return 'Vite';
    case 'react':
      return 'React';
    case 'express':
      return 'Express';
    case 'unknown':
    case 'none':
    case undefined:
      return 'Not detected';
    default:
      return framework;
  }
}

export function formatLanguage(lang?: string): string {
  switch (lang) {
    case 'typescript':
      return 'TypeScript';
    case 'javascript':
      return 'JavaScript';
    default:
      return lang ? lang.toUpperCase() : 'Not detected';
  }
}

export function formatRouter(router?: string): string {
  switch (router) {
    case 'app':
      return 'App Router';
    case 'pages':
      return 'Pages Router';
    case 'hybrid':
      return 'Hybrid (App + Pages)';
    case 'none':
    case undefined:
      return 'Not detected';
    default:
      return router;
  }
}

export function formatPackageManager(pm?: string): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm';
    case 'npm':
      return 'npm';
    case 'yarn':
      return 'yarn';
    case 'bun':
      return 'bun';
    case 'unknown':
    case undefined:
      return 'Not detected';
    default:
      return pm;
  }
}

export function formatDatabase(db?: string): string {
  switch (db) {
    case 'supabase':
      return 'Supabase';
    case 'prisma':
      return 'Prisma';
    case 'drizzle':
      return 'Drizzle';
    case 'mongodb':
      return 'MongoDB';
    case 'firebase':
      return 'Firebase';
    case 'none':
    case 'unknown':
    case undefined:
      return 'Not detected';
    default:
      return db;
  }
}

export function formatAuth(auth?: string): string {
  switch (auth) {
    case 'supabase':
      return 'Supabase Auth';
    case 'clerk':
      return 'Clerk';
    case 'nextauth':
      return 'Auth.js / NextAuth';
    case 'firebase':
      return 'Firebase Auth';
    case 'none':
    case 'unknown':
    case undefined:
      return 'Not detected';
    default:
      return auth;
  }
}

export function formatDeploymentProvider(provider?: string): string {
  switch (provider) {
    case 'vercel':
      return 'Vercel';
    case 'netlify':
      return 'Netlify';
    case 'none':
    case 'unknown':
    case undefined:
      return 'Not detected';
    default:
      return provider;
  }
}

export function formatTestingFrameworks(frameworks?: string[]): string {
  if (!frameworks || frameworks.length === 0) {
    return 'None detected';
  }
  const displayMap: Record<string, string> = {
    vitest: 'Vitest',
    jest: 'Jest',
    playwright: 'Playwright',
    cypress: 'Cypress',
  };
  return frameworks.map((f) => displayMap[f] || f).join(', ');
}

export function formatCategory(category?: string): string {
  switch (category) {
    case 'security':
      return 'Security';
    case 'configuration':
      return 'Configuration';
    case 'code-health':
      return 'Code Health';
    case 'dependencies':
      return 'Dependencies';
    case 'deployment':
      return 'Deployment';
    default:
      return category || '';
  }
}

export function formatSeverity(severity?: string): string {
  if (!severity) return '';
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
