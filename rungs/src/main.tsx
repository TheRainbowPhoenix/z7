import './lib/monaco-setup';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { posthog } from './lib/posthog-init';
import App from './app';
import './index.css';
import { ExecutionService } from './lib/execution-service.js';
import { useStore } from './store/store';
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react';

interface WindowWithExecutionService extends Window {
  ExecutionService?: typeof ExecutionService;
  useStore?: typeof useStore;
}

interface GlobalThisWithExecutionService {
  AOIExecutionService?: typeof ExecutionService;
}

(window as WindowWithExecutionService).ExecutionService = ExecutionService;
(window as WindowWithExecutionService).useStore = useStore;
(globalThis as GlobalThisWithExecutionService).AOIExecutionService = ExecutionService;

const studioApp = (
  <PostHogProvider client={posthog}>
    <PostHogErrorBoundary>
      <App />
    </PostHogErrorBoundary>
  </PostHogProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{studioApp}</React.StrictMode>,
);
