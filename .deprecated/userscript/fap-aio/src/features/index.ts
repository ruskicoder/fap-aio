/**
 * Feature Modules Barrel File
 * 
 * Re-exports feature initialization functions.
 * MoveOut uses a self-contained local module to bypass polyfill/facade issues.
 * GPA and Scheduler still re-export from the extension source.
 * 
 * Features:
 * - GPA Calculator: Grade point average calculations and transcript display
 * - MoveOut Tool: Self-contained module using native fetch + raw localStorage
 * - Scheduler: Weekly schedule visualization and management
 */

// GPA and Scheduler re-export from extension source
export { initGPA } from '../../../../fap-aio/src/contentScript/features/gpa/index.tsx';
export { initScheduler } from '../../../../fap-aio/src/contentScript/features/scheduler/index.ts';

// MoveOut uses self-contained local module (bypasses polyfilled fetch + storage facade)
export { initMoveOut } from './moveout/index.tsx';

console.log('[FAP-AIO Userscript] Feature modules loaded');
