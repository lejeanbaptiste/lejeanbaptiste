import { countTeiMilestones, shouldOpenTeiInSourceMode } from './teiMilestoneHeuristics';

/** Old BDRC shape: one enormous `<p>` holding the whole volume. */
const hugeSingleBlock = (milestones: string): string =>
  `<div type="text"><p>${'x'.repeat(25_000)}${milestones}</p></div>`;

describe('teiMilestoneHeuristics', () => {
  it('counts lb and pb milestones', () => {
    const xml = '<p>a<lb/>b<pb n="1"/>c<lb/>d</p>';
    expect(countTeiMilestones(xml)).toBe(3);
  });

  it('allows visual mode for milestone-heavy TEI when blocks are modest', () => {
    const milestones = Array.from({ length: 120 }, () => '<lb/>').join('');
    const xml = `<div type="text"><p>${milestones}</p></div>`;
    expect(shouldOpenTeiInSourceMode(xml)).toBe(false);
  });

  it('prefers source mode for milestone-heavy TEI in a single huge block', () => {
    const milestones = Array.from({ length: 120 }, () => '<lb/>').join('');
    const xml = hugeSingleBlock(milestones);
    expect(shouldOpenTeiInSourceMode(xml)).toBe(true);
  });

  it('allows visual mode for BDRC imports when blocks are modest', () => {
    const milestones = Array.from({ length: 40 }, () => '<lb/>').join('');
    const xml = `<div type="text"><p>${milestones}</p></div>`;
    expect(shouldOpenTeiInSourceMode(xml, '/project/imported/bdrc/W123/UT456.xml')).toBe(false);
  });

  it('prefers source mode for BDRC imports with moderate milestones in a huge block', () => {
    const milestones = Array.from({ length: 40 }, () => '<lb/>').join('');
    const xml = hugeSingleBlock(milestones);
    expect(shouldOpenTeiInSourceMode(xml, '/project/imported/bdrc/W123/UT456.xml')).toBe(true);
  });

  it('allows visual mode for small documents', () => {
    expect(shouldOpenTeiInSourceMode('<p>hello</p>')).toBe(false);
  });
});
