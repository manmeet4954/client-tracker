// `npm test` — the spec 21 §10 acceptance tests plus the checks that guard the
// declaration contract. Runs on plain Node, no build step, no dependencies.

import { run } from './harness.ts';

import './tree.declarations.test.ts';
import './tree.scopes.test.ts';
import './access.security.test.ts';
import './tree.migrate.test.ts';

process.exit(await run());
