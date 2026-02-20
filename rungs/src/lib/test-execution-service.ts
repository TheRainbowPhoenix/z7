import type { AOIDefinition } from '@repo/plc-core';
import type { CompilationContext, CompilationResult, ExecutionContext } from '@repo/plc-compiler';
import type { ExecutionOptions, ExecutionParameters } from './execution-service';

interface ExecutionServiceAPI {
  compile?: (
    code?: string,
    context?: CompilationContext,
  ) => Promise<CompilationResult> | CompilationResult;
  compileSync?: (code?: string, context?: CompilationContext) => CompilationResult;
  execute?: (
    result: CompilationResult,
    params?: ExecutionParameters,
    options?: ExecutionOptions,
  ) => Promise<ExecutionContext> | ExecutionContext;
  executeSync?: (
    result: CompilationResult,
    params?: ExecutionParameters,
    options?: ExecutionOptions,
  ) => ExecutionContext;
  executeRoutine?: (
    aoi: AOIDefinition,
    routineName: string,
    params?: ExecutionParameters,
    options?: ExecutionOptions,
  ) => Promise<{
    compilationResult: CompilationResult;
    executionContext?: ExecutionContext;
  }>;
  executeRoutineSync?: (
    aoi: AOIDefinition,
    routineName: string,
    params?: ExecutionParameters,
    options?: ExecutionOptions,
  ) => {
    compilationResult: CompilationResult;
    executionContext?: ExecutionContext;
  };
}

declare global {
  interface Window {
    ExecutionService?: ExecutionServiceAPI;
  }
}

const getExecutionService = (): ExecutionServiceAPI | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.ExecutionService;
};

interface TestRunResult {
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  error?: string;
  failures?: string[];
}

interface TagTracker {
  record(tag: string): void;
  consume(): string | undefined;
  reset(): void;
}

const createTagTracker = (): TagTracker => {
  const tags: string[] = [];
  return {
    record(tag: string) {
      tags.push(tag);
    },
    consume() {
      return tags.pop();
    },
    reset() {
      tags.length = 0;
    },
  };
};

interface ExpectationChain {
  toBe(expected: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toEqual(expected: unknown): void;
  toBeGreaterThan(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
}

type TestFunction = () => void | Promise<void>;

interface TestContext {
  results: TestRunResult[];
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: TestFunction) => void;
  expect: (actual: unknown) => ExpectationChain;
  AOIExecutionService: ExecutionServiceAPI;
  AOITestKit: AOITestKit;
}

interface AOITestKitResult {
  inputs: ExecutionParameters;
  outputs: Record<string, unknown>;
  context: ExecutionContext;
}

interface AOITestKit {
  run: (inputs?: ExecutionParameters, options?: ExecutionOptions) => AOITestKitResult;
}

export interface TestExecutionResult {
  success: boolean;
  testContent: string;
  results?: {
    passed: number;
    failed: number;
    total: number;
    duration: number;
    details: TestDetail[];
  };
  error?: string;
}

export interface TestDetail {
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  error?: string;
  failures?: string[];
}

export interface AOITestExecutionResult {
  aoiName: string;
  success: boolean;
  testResults: TestExecutionResult[];
  summary: {
    totalPassed: number;
    totalFailed: number;
    totalTests: number;
    duration: number;
  };
  error?: string;
}

export class TestExecutionService {
  /**
   * Execute all tests for an AOI
   */
  static async executeAOITests(aoi: AOIDefinition): Promise<AOITestExecutionResult> {
    if (!aoi.testing) {
      return {
        aoiName: aoi.name,
        success: false,
        testResults: [],
        summary: {
          totalPassed: 0,
          totalFailed: 0,
          totalTests: 0,
          duration: 0,
        },
        error: 'No test file found',
      };
    }

    const startTime = Date.now();
    const testContent = aoi.testing.content;

    const testResult = await this.executeTestContent(testContent, aoi);

    const duration = Date.now() - startTime;
    const summary = this.calculateSummary([testResult], duration);

    return {
      aoiName: aoi.name,
      success: summary.totalFailed === 0,
      testResults: [testResult],
      summary,
    };
  }

  static async executeTestContent(
    testContent: string,
    aoi?: AOIDefinition,
  ): Promise<TestExecutionResult> {
    try {
      const startTime = Date.now();

      const results = await this.runTestInBrowser(testContent, aoi);

      const duration = Date.now() - startTime;

      return {
        success: results.failed === 0,
        testContent,
        results: {
          ...results,
          duration,
        },
      };
    } catch (error) {
      return {
        success: false,
        testContent,
        error: error instanceof Error ? error.message : 'Test execution failed',
      };
    }
  }

  private static async runTestInBrowser(
    testContent: string,
    aoi?: AOIDefinition,
  ): Promise<{
    passed: number;
    failed: number;
    total: number;
    details: TestDetail[];
  }> {
    return new Promise((resolve) => {
      const details: TestDetail[] = [];
      let passed = 0;
      let failed = 0;
      type ActiveTestRun = TestRunResult & { tagTracker: TagTracker };

      const serialize = (value: unknown): string => {
        try {
          const serialized = JSON.stringify(value);
          return serialized ?? 'undefined';
        } catch {
          return '"[Unserializable]"';
        }
      };

      const activeTestStack: ActiveTestRun[] = [];

      const createExpectation = (
        actual: unknown,
        recordFailure: (message: string) => void,
      ): ExpectationChain => ({
        toBe(expected: unknown) {
          if (actual !== expected) {
            recordFailure(`Expected ${serialize(expected)}, but got ${serialize(actual)}`);
          }
        },
        toBeTruthy() {
          if (!actual) {
            recordFailure(`Expected value to be truthy, but got ${serialize(actual)}`);
          }
        },
        toBeFalsy() {
          if (actual) {
            recordFailure(`Expected value to be falsy, but got ${serialize(actual)}`);
          }
        },
        toEqual(expected: unknown) {
          if (serialize(actual) !== serialize(expected)) {
            recordFailure(`Expected ${serialize(expected)}, but got ${serialize(actual)}`);
          }
        },
        toBeGreaterThan(expected: number) {
          if (typeof actual !== 'number' || actual <= expected) {
            recordFailure(`Expected ${serialize(actual)} to be greater than ${expected}`);
          }
        },
        toBeLessThan(expected: number) {
          if (typeof actual !== 'number' || actual >= expected) {
            recordFailure(`Expected ${serialize(actual)} to be less than ${expected}`);
          }
        },
        toBeGreaterThanOrEqual(expected: number) {
          if (typeof actual !== 'number' || actual < expected) {
            recordFailure(`Expected ${serialize(actual)} to be greater than or equal to ${expected}`);
          }
        },
        toBeLessThanOrEqual(expected: number) {
          if (typeof actual !== 'number' || actual > expected) {
            recordFailure(`Expected ${serialize(actual)} to be less than or equal to ${expected}`);
          }
        },
      });

      const testContext: TestContext = {
        results: [],

        describe(name, fn) {
          try {
            fn();
          } catch (error) {
            testContext.results.push({
              name: `${name} (setup)`,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Setup failed',
              duration: 0,
            });
          }
        },

        it(name, fn) {
          const startTime = performance.now();
          const testRun: ActiveTestRun = {
            name,
            status: 'passed',
            duration: 0,
            failures: [],
            tagTracker: createTagTracker(),
          };

          const finalizeTestRun = () => {
            if (testRun.failures && testRun.failures.length > 0) {
              testRun.status = 'failed';
              testRun.error = testRun.error ?? testRun.failures[0];
            } else {
              testRun.status = 'passed';
              delete testRun.failures;
            }
          };

          const executeTest = async () => {
            activeTestStack.push(testRun);
            try {
              const result = fn();
              if (result instanceof Promise) {
                await result;
              }
              testRun.duration = performance.now() - startTime;
              finalizeTestRun();
              const resultRecord: TestRunResult = {
                name: testRun.name,
                status: testRun.status,
                duration: testRun.duration,
                error: testRun.error,
                failures: testRun.failures,
              };
              testContext.results.push(resultRecord);
            } catch (error) {
              testRun.duration = performance.now() - startTime;
              testRun.status = 'failed';
              if (testRun.failures && testRun.failures.length > 0) {
                testRun.error = testRun.failures[0];
              } else {
                testRun.error = error instanceof Error ? error.message : 'Test failed';
              }
              const resultRecord: TestRunResult = {
                name: testRun.name,
                status: testRun.status,
                duration: testRun.duration,
                error: testRun.error,
                failures: testRun.failures,
              };
              testContext.results.push(resultRecord);
            } finally {
              activeTestStack.pop();
            }
          };

          executeTest().catch(() => {});
        },

        expect(actual) {
          if (activeTestStack.length === 0) {
            throw new Error('expect called outside of a test');
          }

          const registerFailure = (message: string) => {
            const activeTest = activeTestStack[activeTestStack.length - 1];
            if (!activeTest) {
              throw new Error('expect called outside of a test');
            }
            const tagPrefix = activeTest.tagTracker.consume();
            const fullMessage = tagPrefix ? `${tagPrefix}: ${message}` : message;
            if (!activeTest.failures) {
              activeTest.failures = [];
            }
            activeTest.failures.push(fullMessage);
          };

          return createExpectation(actual, registerFailure);
        },

        AOIExecutionService: {
          compile(codeOverride?: string) {
            let code = codeOverride;
            if (!code && aoi) {
              code = aoi.routines.Logic?.content || '';
            }

            const service = getExecutionService();
            if (service?.compileSync) {
              return service.compileSync(code || '');
            }

            throw new Error('ExecutionService not available - cannot compile ST code');
          },
          execute(result, params) {
            const service = getExecutionService();
            if (service?.executeSync) {
              return service.executeSync(result, params);
            }

            throw new Error('ExecutionService not available - cannot execute ST code');
          },
        },
        AOITestKit: createAOITestKit(
          aoi,
          () => activeTestStack[activeTestStack.length - 1]?.tagTracker,
        ),
      };

      try {
        const processedContent = testContent
          .replace(/import\s+.*?from\s+['"`].*?['"`]\s*;?\s*/g, '')
          .replace(/import\s+['"`].*?['"`]\s*;?\s*/g, '');

        const testFunction = new Function(
          'describe',
          'it',
          'test',
          'expect',
          'AOIExecutionService',
          'AOITestKit',
          processedContent,
        );

        testFunction(
          testContext.describe,
          testContext.it,
          testContext.it,
          testContext.expect,
          testContext.AOIExecutionService,
          testContext.AOITestKit,
        );

        setTimeout(() => {
          testContext.results.forEach((result) => {
            const detail: TestDetail = {
              name: result.name,
              status: result.status,
              duration: result.duration,
              error: result.error,
              failures: result.failures,
            };

            details.push(detail);

            if (result.status === 'passed') {
              passed++;
            } else {
              failed++;
            }
          });

          resolve({
            passed,
            failed,
            total: details.length,
            details,
          });
        }, 200);
      } catch (error) {
        details.push({
          name: 'Test execution error',
          status: 'failed',
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown execution error',
        });

        resolve({
          passed: 0,
          failed: 1,
          total: 1,
          details,
        });
      }
    });
  }

  private static calculateSummary(testResults: TestExecutionResult[], duration: number) {
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    for (const result of testResults) {
      if (result.results) {
        totalPassed += result.results.passed;
        totalFailed += result.results.failed;
        totalTests += result.results.total;
      }
    }

    return {
      totalPassed,
      totalFailed,
      totalTests,
      duration,
    };
  }
}

const createAOITestKit = (
  aoi?: AOIDefinition,
  getTagTracker?: () => TagTracker | undefined,
): AOITestKit => {
  return {
    run(inputs: ExecutionParameters = {}, options?: ExecutionOptions) {
      if (!aoi) {
        throw new Error('AOI metadata not available for testing');
      }

      const service = getExecutionService();
      if (service?.executeRoutineSync) {
        const result = service.executeRoutineSync(aoi, 'Logic', inputs, options);
        const { compilationResult, executionContext } = result;

        if (!compilationResult.success || !executionContext) {
          throw new Error(compilationResult.error ?? 'AOI execution failed');
        }

        const outputs = extractOutputs(executionContext, aoi);
        return {
          inputs,
          outputs: createTrackedOutputs(outputs, getTagTracker),
          context: executionContext,
        };
      }

      throw new Error('ExecutionService not available - cannot execute AOI tests');
    },
  };
};

const extractOutputs = (context: ExecutionContext, aoi: AOIDefinition) => {
  const outputs: Record<string, unknown> = {};
  aoi.tags?.forEach((tag) => {
    if (tag.usage === 'output') {
      outputs[tag.name] = context.variables.get(tag.name);
    }
  });
  return outputs;
};

const createTrackedOutputs = (
  outputs: Record<string, unknown>,
  getTagTracker?: () => TagTracker | undefined,
) => {
  if (!getTagTracker) {
    return outputs;
  }

  return new Proxy(outputs, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(target, prop)) {
        const tracker = getTagTracker();
        tracker?.record(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
};
