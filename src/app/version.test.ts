import { describe, expect, it } from 'vitest';
import { fmtBuildDate, versionLabel, versionText } from './version';

describe('numer wersji', () => {
  const info = { build: 69, commit: '2ac7560', date: '2026-11-19', dev: false };

  it('wydanie z main', () => {
    expect(versionLabel(info)).toBe('1.69');
    expect(versionText(info)).toBe('Wersja 1.69 · 19.11.2026 · 2ac7560');
  });

  it('build roboczy', () => {
    expect(versionLabel({ ...info, dev: true })).toBe('1.69-dev');
  });

  it('bez danych z gita', () => {
    const none = { build: 0, commit: '', date: '', dev: true };
    expect(versionLabel(none)).toBe('wersja robocza');
    expect(versionText(none)).toBe('Wersja robocza');
  });

  it('data', () => {
    expect(fmtBuildDate('2026-01-05T10:00:00+01:00')).toBe('05.01.2026');
    expect(fmtBuildDate('')).toBe('');
  });
});
