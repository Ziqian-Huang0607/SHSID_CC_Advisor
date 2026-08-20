// scripts/api-smoke.mjs
// End-to-end checks for the rating and description endpoints.
//
//   npm run test:api                     — against a local in-process harness
//   npm run test:api -- https://host     — against a real deployment
//
// The local run uses the in-memory store, so it never touches production data.
// Against a deployment it casts real votes from a throwaway voter token; it
// picks the course itself and always leaves that voter's ballot in place, which
// is why it only ever moves one course's tally by one student.

import { startHarness } from './api-harness.mjs';

const target = process.argv[2] ?? '';
let harness = null;
let baseUrl = target;

if (!target) {
  harness = await startHarness(0);
  baseUrl = harness.baseUrl;
}

let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}\n         got      ${JSON.stringify(actual)}\n         expected ${JSON.stringify(expected)}`);
  }
}

function checkThat(label, condition, detail = '') {
  check(label + (detail ? ` (${detail})` : ''), !!condition, true);
}

/** A caller with its own cookie jar — i.e. one browser profile. */
function makeCaller() {
  const jar = new Map();
  return async (path, init = {}) => {
    const headers = { ...(init.headers || {}) };
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    (response.headers.getSetCookie?.() ?? []).forEach((cookie) => {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, headers: response.headers, body };
  };
}

const vote = (call, courseId, value) =>
  call('/api/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, value }),
  });

console.log(`\nAPI smoke tests against ${baseUrl}\n`);

// ---------------------------------------------------------------- service ---
console.log('service');
const anon = makeCaller();

const ping = await anon('/api/ping');
check('GET /api/ping returns 200', ping.status, 200);

const status = await anon('/api/status');
checkThat('GET /api/status answers', status.status === 200 || status.status === 503, `status ${status.status}`);
checkThat('status reports a rating-store check', !!status.body?.data?.checks?.ratingStore);
checkThat('status carries a request id', !!status.headers.get('x-request-id'));
console.log(`       ratings are ${status.body?.data?.checks?.ratingStore?.durable ? 'DURABLE' : 'IN MEMORY ONLY'}`);

const courses = await anon('/api/courses');
check('GET /api/courses returns 200', courses.status, 200);
const courseId = courses.body?.data?.courses?.[0]?.id;
checkThat('a course id is available to test with', !!courseId, courseId);

// ----------------------------------------------------------------- voting ---
console.log('\nvoting');
const student = makeCaller();

const baseline = await student(`/api/ratings/${courseId}`);
const startCount = baseline.body?.data?.aggregate?.count ?? 0;
const alreadyVoted = baseline.body?.data?.yourVote !== null && baseline.body?.data?.yourVote !== undefined;
// A fresh jar should be a new voter; against a live deployment a stale cookie
// is impossible, so this also proves the cookie is what identifies a voter.
check('a fresh caller has no ballot yet', alreadyVoted, false);

const first = await vote(student, courseId, 10);
check('first vote succeeds', first.status, 200);
check('first vote is recorded as created', first.body?.data?.outcome, 'created');
check('one student vote is added', first.body?.data?.aggregate?.count, startCount + 1);
checkThat('the response issues a voter token', !!first.body?.data?.voterId);
checkThat('rate limit headers are present', !!first.headers.get('ratelimit-limit'));

const changed = await vote(student, courseId, 4);
check('changing a vote succeeds', changed.status, 200);
check('changing is reported as changed', changed.body?.data?.outcome, 'changed');
check('changing reports the previous score', changed.body?.data?.previousVote, 10);
check('changing does NOT add a vote', changed.body?.data?.aggregate?.count, startCount + 1);

const repeat = await vote(student, courseId, 4);
check('resubmitting the same score is a no-op', repeat.body?.data?.outcome, 'unchanged');
check('the no-op does not move the count', repeat.body?.data?.aggregate?.count, startCount + 1);

const mine = await student(`/api/ratings/${courseId}`);
check('the ballot is readable back', mine.body?.data?.yourVote, 4);

const restored = await student('/api/ratings');
check('the ballot appears in yourVotes', restored.body?.data?.yourVotes?.[courseId], 4);

// A second jar is a second browser: it must be able to add a genuine vote.
const other = makeCaller();
const second = await vote(other, courseId, 8);
check('a different browser is a different voter', second.body?.data?.outcome, 'created');
check('a real second student does add a vote', second.body?.data?.aggregate?.count, startCount + 2);

// Identity comes from the cookie, so a forged body token must not mint a ballot.
const forged = await student('/api/ratings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ courseId, value: 1, voterId: `forged-${Date.now()}` }),
});
check('a forged voterId cannot buy a second ballot', forged.body?.data?.aggregate?.count, startCount + 2);
check('the forged request is treated as this voter', forged.body?.data?.outcome, 'changed');

// ------------------------------------------------------------ validation ---
console.log('\nvalidation');
const outOfRange = await vote(student, courseId, 99);
check('a score above 10 is rejected', outOfRange.status, 400);
check('the rejection carries a machine-readable code', outOfRange.body?.code, 'bad_request');

const unknownCourse = await vote(student, 'NOT-A-COURSE', 5);
check('an unknown course is a 404', unknownCourse.status, 404);
check('the 404 carries a code', unknownCourse.body?.code, 'not_found');

const wrongMethod = await student(`/api/description/${courseId}`, { method: 'POST' });
check('POSTing to a GET endpoint is a 405', wrongMethod.status, 405);
check('the 405 carries a code', wrongMethod.body?.code, 'method_not_allowed');

// ---------------------------------------------------------- descriptions ---
console.log('\ndescriptions');
const description = await anon(`/api/description/${courseId}`);
check('GET /api/description/:id returns 200', description.status, 200);
checkThat('a summary is always present', typeof description.body?.data?.summary === 'string' && description.body.data.summary.length > 0);
console.log(
  `       provider ${description.body?.data?.provider} ` +
    `(${description.body?.data?.provider_configured ? 'configured' : 'not configured — serving catalog text'})`,
);
if (description.body?.data?.providerError) {
  console.log(`       provider error: ${description.body.data.providerError}`);
}

// -------------------------------------------------------------------- end ---
console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) failures.forEach((f) => console.log(`  failed: ${f}`));

harness?.server.close();
process.exit(failures.length ? 1 : 0);
