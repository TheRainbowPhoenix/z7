import { describe, it, expect, AOITestKit } from './test-helper.js';

describe('Logic Runner', async () => {
    console.log('Running E2E Logic Tests...');
    await import('./cylinder.test.js');
    await import('./motor.test.js');
    await import('./traffic.test.js');
    await import('./tank.test.js');

    console.log('\nRunning ST Specific Tests...');
    await import('./st_specific.test.js');

    console.log('\nRunning AOI Integration Tests...');
    await import('./aoi_integration.test.js');
});
