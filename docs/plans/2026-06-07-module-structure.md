# ERP Module Structure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the initial source and documentation module skeleton for the ERP described by the Excel analysis documents.

**Architecture:** Use domain modules that match the ERP business workflow: master data feeds service calls, service calls feed room status and settlements, settlements feed monthly closing, and dashboard reads across the workflow. Keep implementation placeholders as README files because no framework has been selected.

**Tech Stack:** Plain filesystem scaffold and Markdown documentation. No runtime dependencies.

---

### Task 1: Create Plan Documents

**Files:**
- Create: `docs/plans/2026-06-07-module-structure-design.md`
- Create: `docs/plans/2026-06-07-module-structure.md`

**Step 1: Create the approved design document**

Write the design summary, assumptions, chosen approach, alternatives, data flow, error boundaries, and testing direction.

**Step 2: Create this implementation plan**

Write the module-scaffold tasks with exact file paths.

**Step 3: Verify**

Run: `find docs/plans -maxdepth 1 -type f -print`

Expected: both plan files are listed.

### Task 2: Create Source Module Skeleton

**Files:**
- Create: `src/modules/README.md`
- Create: `src/modules/masters/README.md`
- Create: `src/modules/calls/README.md`
- Create: `src/modules/rooms/README.md`
- Create: `src/modules/settlements/README.md`
- Create: `src/modules/closing/README.md`
- Create: `src/modules/dashboard/README.md`
- Create: `src/modules/audit/README.md`
- Create: `src/shared/README.md`
- Create: `src/shared/constants/README.md`
- Create: `src/shared/types/README.md`
- Create: `src/shared/utils/README.md`

**Step 1: Create module README files**

Each README should define responsibility, source documents, upstream dependencies, downstream consumers, and explicit non-responsibilities.

**Step 2: Verify**

Run: `find src -maxdepth 4 -type f -print | sort`

Expected: all module and shared README files are listed.

### Task 3: Create Module Reference Documentation

**Files:**
- Create: `docs/modules/README.md`
- Create: `docs/modules/masters.md`
- Create: `docs/modules/calls.md`
- Create: `docs/modules/rooms.md`
- Create: `docs/modules/settlements.md`
- Create: `docs/modules/closing.md`
- Create: `docs/modules/dashboard.md`
- Create: `docs/modules/audit.md`

**Step 1: Create module reference docs**

Document each module with source Excel sheets, core entities, rules, and handoff points.

**Step 2: Verify**

Run: `find docs/modules -maxdepth 1 -type f -print | sort`

Expected: the README and seven module docs are listed.

### Task 4: Final Verification

**Files:**
- Read: `docs/modules/README.md`
- Read: `src/modules/README.md`

**Step 1: Check scaffold tree**

Run: `find src docs/modules docs/plans -maxdepth 4 -type f -print | sort`

Expected: plan files, module docs, and source skeleton files are present.

**Step 2: Check no empty README files**

Run: `find src docs/modules docs/plans -name '*.md' -type f -size 0 -print`

Expected: no output.

**Step 3: Commit**

Skipped. This workspace is not a Git repository.

