import type { AOIDefinition, TestConfiguration } from '@repo/plc-core';
import { AOIDefinitionSchema, TestDefinitionSchema } from '@repo/plc-core';

export function createTestContentForAOI(aoiName: string): string {
  return `import { describe, it, expect } from 'vitest';

describe('${aoiName} AOI Tests', () => {
  it('should execute basic functionality', () => {
    const result = AOIExecutionService.compile('// Your AOI logic here');
    expect(result.success).toBe(true);
  });
});`;
}

export function createTestingForAOI(aoiName: string): TestConfiguration {
  return TestDefinitionSchema.parse({
    content: createTestContentForAOI(aoiName),
    config: {
      timeout: 5000,
      maxIterations: 100,
      enableDebugMode: true,
    },
  });
}

export function createEmptyAOI(name: string, language: 'st' | 'ld' = 'ld'): AOIDefinition {
  return AOIDefinitionSchema.parse({
    name,
    description: '',
    tags: [],
    routines: {
      Logic: {
        type: language,
        content: '',
      },
    },
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      major: 1,
      minor: 0,
      build: 0,
    },
    testing: createTestingForAOI(name),
  });
}
