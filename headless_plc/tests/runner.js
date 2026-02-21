import { describe, it, expect, AOITestKit } from './test-helper.js';

describe('Logic Runner', async () => {
    // Import all test files to run them
    await import('./cylinder.test.js');
    await import('./motor.test.js');
    await import('./traffic.test.js');
    await import('./tank.test.js');
});
