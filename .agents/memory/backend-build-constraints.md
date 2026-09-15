---
name: Backend build constraints
description: Environment-specific constraints discovered while building full-stack workspace apps.
---

When a standalone TypeScript utility is needed in this workspace, prefer adding it as an entry point to the existing esbuild bundle if a new runtime runner cannot be installed.

**Why:** The workspace's package installation callback may reject an otherwise reasonable small dependency, while the API server already has a working TypeScript-to-ESM build path.

**How to apply:** Keep the utility source beside the server source, bundle it with the existing build, and expose a package script that runs the emitted module.