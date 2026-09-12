// @vitest-environment jsdom

import React, { act, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeEqDashboardPage from '../../app/page';
import * as apiClient from '../../lib/api/client';
import {
  mockBlockedResult,
  mockHealthyResult,
} from '../../lib/fixtures/mockResults';
import { FindingCard } from '../FindingCard';
import { FindingDrawer } from '../FindingDrawer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function buttonWithText(text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text)
  );

  if (!button) throw new Error(`Could not find button containing "${text}"`);
  return button;
}

function click(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function DrawerHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const closeDrawer = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open diagnosis</button>
      <FindingDrawer
        finding={isOpen ? mockBlockedResult.scan.findings[0] : null}
        onClose={closeDrawer}
      />
    </>
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('dashboard interactions', () => {
  it('opens a finding from the keyboard', async () => {
    const onSelect = vi.fn();
    const finding = mockBlockedResult.scan.findings[0];
    await act(async () => root.render(
      <FindingCard finding={finding} onSelect={onSelect} />
    ));

    const card = container.querySelector<HTMLElement>('[role="button"]');
    if (!card) throw new Error('Could not find finding card button');
    card.focus();
    await act(async () => {
      card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledWith(finding);
  });

  it('moves focus into the diagnosis drawer and restores it after Escape', async () => {
    await act(async () => root.render(<DrawerHarness />));

    const opener = buttonWithText('Open diagnosis');
    opener.focus();
    await act(async () => click(opener));

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close diagnosis drawer');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close diagnosis drawer');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.activeElement).toBe(opener);
  });

  it('moves a failed rescan into the error state', async () => {
    const scan = vi.spyOn(apiClient, 'scanRepository');
    scan.mockResolvedValueOnce(mockHealthyResult);

    await act(async () => root.render(<CodeEqDashboardPage />));
    await act(async () => click(buttonWithText('Try demo repository')));
    expect(container.textContent).toContain('alibuildsx / CodeEq');

    scan.mockRejectedValueOnce(
      new apiClient.FrontendScanError('SCAN_TIMEOUT', 'Repository scan timed out', 504)
    );
    await act(async () => click(buttonWithText('Rescan')));

    expect(container.textContent).toContain('SCAN TIMEOUT');
    expect(container.textContent).toContain('The repository scan timed out.');
  });
});
