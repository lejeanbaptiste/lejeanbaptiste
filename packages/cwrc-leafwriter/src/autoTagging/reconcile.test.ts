import { addEntity, createEntitiesScaffold, findEntity, parseEntities, touchEntity } from './entities';
import { applyReconcilePlan, planReconcile, readFields } from './reconcile';

/** Two independent single-entity databases (PEDB and CEDB). */
const setup = () => {
  const pedbDoc = parseEntities(createEntitiesScaffold('pedb'));
  const cedbDoc = parseEntities(createEntitiesScaffold('cedb'));
  return { pedbDoc, cedbDoc };
};

describe('planReconcile', () => {
  it('reports identical when both records agree', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', authorityIds: [{ type: 'CBDB', value: '1' }] }).element;
    const c = addEntity(cedbDoc, 'person', { name: '張衡', authorityIds: [{ type: 'CBDB', value: '1' }] }).element;
    expect(planReconcile(p, c).identical).toBe(true);
  });

  it('unions names and authorities both ways (no conflict)', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', authorityIds: [{ type: 'CBDB', value: '1' }] }).element;
    const c = addEntity(cedbDoc, 'person', {
      name: '張衡',
      altNames: [{ text: '平子' }],
      authorityIds: [{ type: 'Wikidata', value: 'Q11332' }],
    }).element;
    const plan = planReconcile(p, c);
    expect(plan.addNamesToPedb.map((n) => n.text)).toEqual(['平子']);
    expect(plan.addAuthoritiesToPedb).toEqual([{ type: 'Wikidata', value: 'Q11332' }]);
    expect(plan.addAuthoritiesToCedb).toEqual([{ type: 'CBDB', value: '1' }]);
    expect(plan.conflicts).toHaveLength(0);
  });

  it('fills an empty scalar from the other side', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', description: 'Han polymath' }).element;
    const c = addEntity(cedbDoc, 'person', { name: '張衡' }).element;
    const plan = planReconcile(p, c);
    expect(plan.fillCedb.description).toBe('Han polymath');
    expect(plan.conflicts).toHaveLength(0);
  });

  it('flags a same-field disagreement as a conflict with the newer side', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', startYear: 78 }).element;
    const c = addEntity(cedbDoc, 'person', { name: '張衡', startYear: 79 }).element;
    touchEntity(p, '2020-01-01T00:00:00Z');
    touchEntity(c, '2026-01-01T00:00:00Z'); // CEDB newer
    const plan = planReconcile(p, c);
    expect(plan.conflicts).toEqual([
      { field: 'startYear', pedbValue: 78, cedbValue: 79, newer: 'cedb' },
    ]);
  });
});

describe('applyReconcilePlan', () => {
  it('converges the two records for non-conflicting differences', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', {
      name: '張衡',
      description: 'Han polymath',
      authorityIds: [{ type: 'CBDB', value: '1' }],
    });
    const c = addEntity(cedbDoc, 'person', {
      name: '張衡',
      altNames: [{ text: '平子' }],
      authorityIds: [{ type: 'Wikidata', value: 'Q11332' }],
    });

    const plan = planReconcile(p.element, c.element);
    const { pedbChanged, cedbChanged } = applyReconcilePlan(pedbDoc, p.id, cedbDoc, c.id, plan);
    expect(pedbChanged).toBe(true);
    expect(cedbChanged).toBe(true);

    // now both should agree (re-plan is identical)
    const pAfter = findEntity(pedbDoc, p.id)!;
    const cAfter = findEntity(cedbDoc, c.id)!;
    expect(planReconcile(pAfter, cAfter).identical).toBe(true);

    const pf = readFields(pAfter);
    expect(pf.names.map((n) => n.text).sort()).toEqual(['平子', '張衡']);
    expect(pf.authorities.map((a) => a.type).sort()).toEqual(['CBDB', 'Wikidata']);
    expect(readFields(cAfter).description).toBe('Han polymath');
  });

  it('leaves conflicting fields untouched (they need a decision)', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', startYear: 78 });
    const c = addEntity(cedbDoc, 'person', { name: '張衡', startYear: 79 });
    const plan = planReconcile(p.element, c.element);
    applyReconcilePlan(pedbDoc, p.id, cedbDoc, c.id, plan);
    expect(readFields(findEntity(pedbDoc, p.id)!).startYear).toBe(78);
    expect(readFields(findEntity(cedbDoc, c.id)!).startYear).toBe(79);
  });

  it('syncs a year onto the side that lacked it', () => {
    const { pedbDoc, cedbDoc } = setup();
    const p = addEntity(pedbDoc, 'person', { name: '張衡', startYear: 78, endYear: 139 });
    const c = addEntity(cedbDoc, 'person', { name: '張衡' });
    const plan = planReconcile(p.element, c.element);
    applyReconcilePlan(pedbDoc, p.id, cedbDoc, c.id, plan);
    const cf = readFields(findEntity(cedbDoc, c.id)!);
    expect([cf.startYear, cf.endYear]).toEqual([78, 139]);
  });
});
