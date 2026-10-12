// A single process also works in sandboxes that prohibit test-worker spawning.
require('./client.test.cjs');
require('./security-storage.test.cjs');
require('./admin-config.test.cjs');
require('./legacy-tests.test.cjs');
require('./read-reuse.test.cjs');
require('./request-read-reuse.test.cjs');
require('./save-read-reuse.test.cjs');
require('./step-navigation.test.cjs');
require('./last-saved-time.test.cjs');
require('./performance-policy.test.cjs');
require('./ui-performance.test.cjs');

require('./second-pass.test.cjs');
require('./final-performance.test.cjs');

require('./receipt-allowlist.test.cjs');
require('./staging-diagnostics.test.cjs');
require('./concurrency-hotpath.test.cjs');
require('./proxy-transport.test.cjs');
require('./roster-options-regression.test.cjs');
require('./unchanged-patch.test.cjs');
require('./lock-function-timing.test.cjs');
require('./transactional.test.cjs');
require('./transactional-client.test.cjs');
require('./transactional-recovery.test.cjs');
require('./transactional-runtime.test.cjs');
