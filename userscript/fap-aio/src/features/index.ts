/**
 * Feature Modules Barrel File
 * 
 * Re-exports feature initialization functions from the extension source.
 * This barrel file provides a centralized import point for the userscript router.
 * 
 * Features:
 * - GPA Calculator: Grade point average calculations and transcript display
 * - MoveOut Tool: Course registration notifications and tracking
 * - Scheduler: Weekly schedule visualization and management
 */

// Re-export feature initialization functions from extension source
export { initGPA } from '../../../../fap-aio/src/contentScript/features/gpa/index.tsx';
export { initMoveOut } from '../../../../fap-aio/src/contentScript/features/moveout/index.tsx';
export { initScheduler } from '../../../../fap-aio/src/contentScript/features/scheduler/index.ts';

console.log('[FAP-AIO Userscript] Feature modules loaded');
