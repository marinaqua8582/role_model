// A single process also works in sandboxes that prohibit test-worker spawning.
require('./client.test.cjs');
require('./security-storage.test.cjs');
require('./admin-config.test.cjs');
require('./legacy-tests.test.cjs');
require('./read-reuse.test.cjs');
require('./request-read-reuse.test.cjs');
