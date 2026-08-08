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
// the restructure, phases 2 to 5 — one file per screen, each owned by the agent
// that built that screen
import './creation.board.test.ts';
import './creation.piece.test.ts';
import './creation.logs.test.ts';
import './creation.assets.test.ts';
import './analysis.groups.test.ts';
import './intake.screens.test.ts';
// spec 30 — the desk chat's tool layer
import './desk.read.test.ts';
import './desk.write.test.ts';
import './desk.loop.test.ts';
// spec 33 — intake by document, and the form that behaves like one
import './intake.form.test.ts';
import './intake.documents.test.ts';
import './intake.curation.test.ts';
// spec 34 — the Strategy room
import './strategy.inputs.test.ts';
import './strategy.plain.test.ts';
import './strategy.reading.test.ts';
// spec 35 — the profile mockup
import './mockup.test.ts';

process.exit(await run());
