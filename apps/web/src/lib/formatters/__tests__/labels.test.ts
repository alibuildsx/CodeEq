import { describe, expect, it } from 'vitest';
import {
  formatAuth,
  formatCategory,
  formatDatabase,
  formatDeploymentProvider,
  formatFramework,
  formatLanguage,
  formatPackageManager,
  formatRouter,
  formatSeverity,
  formatTestingFrameworks,
} from '../labels';

describe('Project Intelligence Label Formatters', () => {
  it('formats frameworks into human-readable labels', () => {
    expect(formatFramework('nextjs')).toBe('Next.js');
    expect(formatFramework('vite')).toBe('Vite');
    expect(formatFramework('react')).toBe('React');
    expect(formatFramework('express')).toBe('Express');
    expect(formatFramework('unknown')).toBe('Not detected');
    expect(formatFramework('none')).toBe('Not detected');
    expect(formatFramework(undefined)).toBe('Not detected');
  });

  it('formats languages properly', () => {
    expect(formatLanguage('typescript')).toBe('TypeScript');
    expect(formatLanguage('javascript')).toBe('JavaScript');
    expect(formatLanguage(undefined)).toBe('Not detected');
  });

  it('formats router types into clear product concepts', () => {
    expect(formatRouter('app')).toBe('App Router');
    expect(formatRouter('pages')).toBe('Pages Router');
    expect(formatRouter('hybrid')).toBe('Hybrid (App + Pages)');
    expect(formatRouter('none')).toBe('Not detected');
  });

  it('formats package managers', () => {
    expect(formatPackageManager('pnpm')).toBe('pnpm');
    expect(formatPackageManager('npm')).toBe('npm');
    expect(formatPackageManager('yarn')).toBe('yarn');
    expect(formatPackageManager('bun')).toBe('bun');
    expect(formatPackageManager('unknown')).toBe('Not detected');
  });

  it('formats databases and providers', () => {
    expect(formatDatabase('supabase')).toBe('Supabase');
    expect(formatDatabase('prisma')).toBe('Prisma');
    expect(formatDatabase('drizzle')).toBe('Drizzle');
    expect(formatDatabase('mongodb')).toBe('MongoDB');
    expect(formatDatabase('none')).toBe('Not detected');
  });

  it('formats authentication providers', () => {
    expect(formatAuth('supabase')).toBe('Supabase Auth');
    expect(formatAuth('clerk')).toBe('Clerk');
    expect(formatAuth('nextauth')).toBe('Auth.js / NextAuth');
    expect(formatAuth('none')).toBe('Not detected');
  });

  it('formats deployment providers', () => {
    expect(formatDeploymentProvider('vercel')).toBe('Vercel');
    expect(formatDeploymentProvider('netlify')).toBe('Netlify');
    expect(formatDeploymentProvider('none')).toBe('Not detected');
  });

  it('formats testing frameworks lists', () => {
    expect(formatTestingFrameworks(['vitest', 'playwright'])).toBe('Vitest, Playwright');
    expect(formatTestingFrameworks(['jest', 'cypress'])).toBe('Jest, Cypress');
    expect(formatTestingFrameworks([])).toBe('None detected');
    expect(formatTestingFrameworks(undefined)).toBe('None detected');
  });

  it('formats categories and severities', () => {
    expect(formatCategory('security')).toBe('Security');
    expect(formatCategory('configuration')).toBe('Configuration');
    expect(formatCategory('code-health')).toBe('Code Health');
    expect(formatCategory('dependencies')).toBe('Dependencies');
    expect(formatCategory('deployment')).toBe('Deployment');

    expect(formatSeverity('critical')).toBe('Critical');
    expect(formatSeverity('high')).toBe('High');
    expect(formatSeverity('medium')).toBe('Medium');
    expect(formatSeverity('low')).toBe('Low');
  });
});
