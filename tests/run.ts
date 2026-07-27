// `npm test` — the spec 21 §10 acceptance tests plus the checks that guard the
// declaration contract. Runs on plain Node, no build step, no dependencies.

import { run } from './harness.ts';

import './tree.declarations.test.ts';
import './tree.scopes.test.ts';
import './access.security.test.ts';
import './tree.migrate.test.ts';
import './intake.test.ts';
import './strategy.test.ts';
import './engine.test.ts';
import './costume.test.ts';
import './brief.test.ts';
import './gates.test.ts';
// spec 26
import './tracking.test.ts';
// spec 27
import './analysis.test.ts';
// spec 28
import './shell.test.ts';

process.exit(await run());
