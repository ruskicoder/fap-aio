# Spec Updates Summary - Build-Time Module Substitution Architecture

## ✅ Updates Completed

### 1. **requirements.md**
- ✅ Added new **Requirement 17: Build-Time Module Substitution for Platform Abstraction**
- 16 acceptance criteria covering:
  - Build-time module redirection via Vite aliases
  - Storage facade matching extension interface exactly
  - StorageItem<T> wrapper format: `{ value: T, expiry?: number }`
  - TTL support via `ttlInMinutes` parameter
  - Fetch polyfill injection at runtime
  - Response-compatible object return
  - Isolated failure guarantees (extension unchanged, userscript adapts)

### 2. **design.md**
- ✅ **Completely rewrote Architecture section** with:
  - **Build-Time Module Substitution Strategy** overview
  - Detailed directory structure showing facades/ and polyfills/ layers
  - **Build-time alias configuration** (Vite resolve.alias examples)
  - **Storage Facade implementation** (full code with all methods)
  - **Fetch Polyfill implementation** (runtime injection, Response object)
  - **Main entry point** showing polyfill injection BEFORE features load
  - **Cross-Affection Isolation table** showing impact scenarios
  - **Architecture diagram** (Mermaid) showing build-time vs runtime flows
  - **Data flow examples** for storage and fetch operations

### 3. **tasks.md**
- ✅ **Phase 1 restructured** (10 tasks):
  - 1.1: Directory structure with facades/ and polyfills/
  - 1.2: Storage Adapter (low-level GM wrapper only)
  - 1.3: HTTP Adapter (low-level GM wrapper)
  - 1.4: Style Adapter (unchanged)
  - **1.5: NEW - Storage Facade** (extension-compatible interface)
  - **1.6: NEW - Fetch Polyfill** (runtime injection)
  - 1.7: Metadata generator
  - 1.8: Feature barrel file
  - 1.9: TypeScript config
  - 1.10: .gitignore

- ✅ **Phase 2 updated** (2 tasks):
  - 2.1: Main entry point with **fetch polyfill injection FIRST**
  - 2.2: Router with **NO dependency injection** (features called with no params)

- ✅ **Phase 3 updated** (4 tasks):
  - 3.1: Vite config with **build-time aliases** (storage → facade)
  - 3.2: Metadata plugin (unchanged)
  - 3.3: CSS plugin (unchanged)
  - 3.4: Build scripts with **bundle verification** (grep checks)

- ✅ **Phase 4 renamed and updated**:
  - Title changed to "Feature Module Verification and Testing"
  - 4.1-4.3: Verify features work via aliasing/polyfills (NOT modify code)
  - 4.4: Userstyle verification
  - **4.5: NEW - Build output and bundle analysis**

---

## 🔍 Clarification Questions

Before proceeding with implementation, I need clarification on:

### **Q1: Scheduler Storage Module**
The scheduler feature has its own local `storage.ts` module (`fap-aio/src/contentScript/features/scheduler/storage.ts`) separate from the shared storage. It's a simple wrapper around localStorage:

```typescript
export const storage = {
  get: <T = any>(key: string): T | null => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },
  set: (key: string, value: any): void => {
    localStorage.setItem(key, JSON.stringify(value));
  }
};
```

**Should I:**
- **A)** Add another Vite alias to redirect scheduler's local storage to the facade?
- **B)** Modify scheduler to import from shared storage (in extension, breaking change)?
- **C)** Leave it as-is and let scheduler use localStorage directly (works but inconsistent)?

**Recommendation**: Option A (add alias `@/contentScript/features/scheduler/storage` → facade)

I choose A

---

### **Q2: Extension Storage getRaw/setRaw Methods**
The extension's shared storage has `getRaw` and `setRaw` methods that bypass the StorageItem wrapper and directly access localStorage. Features like MoveOut use `storage.getRaw(subject)` for backward compatibility.

**For the facade, should:**
- **A)** getRaw/setRaw bypass the StorageItem wrapper (store plain values without wrapping)?
- **B)** getRaw/setRaw also use the wrapper for consistency?

**Current extension behavior:**
```typescript
// Extension code
storage.setRaw('subject', timeTableData); // stores timeTableData directly
let cached = storage.getRaw(subject);     // retrieves timeTableData directly (no wrapper)
```

**Recommendation**: Option A (bypass wrapper for Raw methods to match extension)

I choose A
---

### **Q3: Fetch Polyfill - FormData Support**
The fetch polyfill currently throws an error for `formData()` method. Extension features may or may not use form data.

**Should I:**
- **A)** Implement formData() parsing (parse `multipart/form-data` responses)?
- **B)** Keep it as error-throwing (features don't need it)?
- **C)** Return empty FormData (partial support)?

**Recommendation**: Option B initially (add later if needed)

I choose B

---

### **Q4: HTTP Adapter - POST Form Submission**
MoveOut feature submits forms with POST requests. The current HTTP adapter accepts `data: any` parameter.

**For form submissions, should the adapter:**
- **A)** Auto-detect FormData/URLSearchParams and set Content-Type automatically?
- **B)** Require caller to set Content-Type explicitly?
- **C)** Provide dedicated `submitForm()` method?

**Recommendation**: Option A (auto-detect and set headers for ease of use)

I choose A

---

### **Q5: Error Boundary Integration**
The specs mention error boundaries for React components, but the current approach is to let features use ReactDOM.createRoot() directly.

**Should I:**
- **A)** Create mount utility with error boundary (as originally planned)?
- **B)** Skip error boundary for now (you said "keep them using react dom")?
- **C)** Add error boundary to each feature's root component manually?

**Recommendation**: Option B (skip for now, can add later)

I choose B
---

### **Q6: Debug Mode Flag**
Requirements mention a debug mode for verbose logging.

**Should debug mode be:**
- **A)** Checked via GM storage: `GM_getValue('fap-aio:debug')`?
- **B)** Checked via localStorage: `localStorage.getItem('fap-aio:debug')`?
- **C)** Hardcoded constant in main.ts (change and rebuild for debugging)?
- **D)** URL parameter: `?fap_debug=true`?

**Recommendation**: Option A (persistent across sessions, uses GM storage)

I choose A
---

## 📋 Next Steps After Approval

Once you answer the questions above, I will:

1. ✅ Update adapter implementations based on your answers
2. ✅ Implement storage facade with exact extension interface
3. ✅ Implement fetch polyfill with Response compatibility
4. ✅ Update Vite config with all necessary aliases
5. ✅ Update main.ts to inject polyfill first
6. ✅ Update router to call features without parameters
7. ✅ Verify build bundles facade (not extension storage)
8. ✅ Test with real FAP pages

**Estimated implementation time**: 1-2 hours after approval

---

## 🎯 Key Architecture Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Code Sharing Strategy** | Build-Time Module Substitution | Extension unchanged, maximum compatibility |
| **Storage Compatibility** | Facade with StorageItem<T> wrapper | Matches extension interface exactly |
| **Network Requests** | Fetch polyfill (runtime injection) | Zero code changes to features |
| **React Mounting** | Direct ReactDOM.createRoot() | Per user preference, no mount utility |
| **Dependency Injection** | None (build-time aliasing instead) | Features work without parameter changes |
| **Cross-Affection** | Extension is source of truth | Userscript adapts, failures isolated |

Please review and answer the 6 questions above, then I'll proceed with implementation.

I have answered the questions in the sections above. Please update specs and proceed with implementation.
