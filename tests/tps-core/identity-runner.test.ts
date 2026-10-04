// ADR-405 — isolated identity-gate runner: the plan refuses everything that is not explicitly switched on and
// approved, the signals gate honours the runner scope without ever turning a READ path on, and the projection
// scope parser is strict. (Equivalence with the full chain is proven on the rehearsal replica, not here.)
import { planIdentityRunner, IDENTITY_RUNNER_APPROVED_CATEGORIES } from '../../scripts/worker/lib/identity-runner';
import { identityGateEnabled, identityRunnerScope, identitySignalsEnabled } from '../../scripts/tps-core/identity-flags';
import { parseCategoryScope } from '../../scripts/build-tps-projection';

const ON = { WORKER_JOB_IDENTITY_GATE_ENABLED: '1', TPS_IDENTITY_RUNNER_CATEGORIES: 'tv,vacuum' } as NodeJS.ProcessEnv;

describe('planIdentityRunner', () => {
  test('default OFF — and independent of the refresh-chain switches', () => {
    expect(planIdentityRunner({}).enabled).toBe(false);
    expect(planIdentityRunner({ TPS_IDENTITY_RUNNER_CATEGORIES: 'tv' }).enabled).toBe(false);
    // the chain switches neither enable nor disable it
    expect(planIdentityRunner({ ...ON, WORKER_JOB_REFRESH_ENABLED: '0', OBSERVATION_SYNC_ENABLED: '0' }).enabled).toBe(true);
    expect(planIdentityRunner({ WORKER_JOB_REFRESH_ENABLED: '1', OBSERVATION_SYNC_ENABLED: '1' }).enabled).toBe(false);
  });
  test('switch must be exactly "1"; empty or missing scope refuses', () => {
    expect(planIdentityRunner({ ...ON, WORKER_JOB_IDENTITY_GATE_ENABLED: 'true' }).enabled).toBe(false);
    expect(planIdentityRunner({ ...ON, TPS_IDENTITY_RUNNER_CATEGORIES: ' , ' }).enabled).toBe(false);
  });
  test('categories outside the approved wave are REFUSED, not silently dropped', () => {
    const p = planIdentityRunner({ ...ON, TPS_IDENTITY_RUNNER_CATEGORIES: 'tv,mobile' });
    expect(p.enabled).toBe(false);
    expect(p.reason).toContain('mobile');
    expect(IDENTITY_RUNNER_APPROVED_CATEGORIES).toEqual(['tv', 'vacuum']);
  });
  test('shadow = signals only; projection only when explicitly switched on; scope always passed', () => {
    const shadow = planIdentityRunner(ON);
    expect(shadow.args).toEqual(['--only', 'identity-gate', '--scope=tv,vacuum']);
    expect(shadow.projection).toBe(false);
    const full = planIdentityRunner({ ...ON, TPS_IDENTITY_RUNNER_PROJECTION: '1', TPS_IDENTITY_RUNNER_CATEGORIES: 'Vacuum, TV,tv' });
    expect(full.args).toEqual(['--only', 'identity-gate,projection', '--scope=tv,vacuum']);
  });
  test('the plan can only ever name the two refresh steps — never normalize / facts / search / storefront', () => {
    for (const env of [ON, { ...ON, TPS_IDENTITY_RUNNER_PROJECTION: '1' }]) {
      const only = planIdentityRunner(env).args[1].split(',');
      expect(only.every((s) => ['identity-gate', 'projection'].includes(s))).toBe(true);
    }
  });
});

describe('signals gate vs read gate', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  test('runner scope computes signals but never turns a read path on', () => {
    delete process.env.TPS_IDENTITY_GATE; delete process.env.TPS_IDENTITY_V2;
    process.env.TPS_IDENTITY_RUNNER_CATEGORIES = 'tv,vacuum';
    expect(identitySignalsEnabled('tv')).toBe(true);
    expect(identityGateEnabled('tv')).toBe(false);
    expect(identitySignalsEnabled('mobile')).toBe(false);
  });
  test('nothing configured ⇒ nothing processed (flag-off behaviour unchanged)', () => {
    delete process.env.TPS_IDENTITY_GATE; delete process.env.TPS_IDENTITY_V2; delete process.env.TPS_IDENTITY_RUNNER_CATEGORIES;
    expect(identitySignalsEnabled('tv')).toBe(false);
    expect(identityRunnerScope()).toEqual([]);
  });
  test('the read gate alone still enables signals (full-chain path unchanged)', () => {
    delete process.env.TPS_IDENTITY_RUNNER_CATEGORIES;
    process.env.TPS_IDENTITY_GATE = 'tv';
    expect(identitySignalsEnabled('tv')).toBe(true);
    expect(identitySignalsEnabled('vacuum')).toBe(false);
  });
  test('malformed scope names are dropped', () => {
    expect(identityRunnerScope("tv, ;drop table x, Vacuum")).toEqual(['tv', 'vacuum']);
  });
});

describe('projection --categories scope', () => {
  test('absent ⇒ null (unscoped build)', () => expect(parseCategoryScope(['--dry'])).toBeNull());
  test('normalised, de-duplicated, sorted', () => expect(parseCategoryScope(['--categories=Vacuum,tv,tv'])).toEqual(['tv', 'vacuum']));
  test('anything that is not a plain identifier is rejected (the names are inlined into SQL)', () => {
    expect(() => parseCategoryScope(["--categories=tv'); drop table x;--"])).toThrow();
    expect(() => parseCategoryScope(['--categories='])).toThrow();
  });
});
