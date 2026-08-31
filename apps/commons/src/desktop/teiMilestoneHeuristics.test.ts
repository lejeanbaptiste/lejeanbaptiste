import { describe, expect, it } from 'vitest';
import { countTeiMilestones, shouldOpenTeiInSourceMode } from './teiMilestoneHeuristics';

describe('teiMilestoneHeuristics', () => {
  it('counts lb and pb milestones', () => {
    const xml = '<p>a<lb/>b<pb n="1"/>c<lb/>d</p>';
    expect(countTeiMilestones(xml)).toBe(3);
  });

  it('prefers source mode for milestone-heavy TEI', () => {
    const milestones = Array.from({ length: 120 }, () => '<lb/>').join('');
    const xml = `<div type="text"><p>${milestones}</p></div>`;
    expect(shouldOpenTeiInSourceMode(xml)).toBe(true);
  });

  it('prefers source mode for BDRC imports with moderate milestones', () => {
    const milestones = Array.from({ length: 40 }, () => '<lb/>').join('');
    const xml = `<div type="text"><p>${milestones}</p></div>`;
    expect(
      shouldOpenTeiInSourceMode(xml, '/project/imported/bdrc/W123/UT456.xml'),
    ).toBe(true);
  });

  it('allows visual mode for small documents', () => {
    expect(shouldOpenTeiInSourceMode('<p>hello</p>')).toBe(false);
  });
});
