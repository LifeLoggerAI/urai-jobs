#!/bin/bash

# Exit on any error
set -e

# --- Setup and Backup ---
TIMESTAMP=$(date +%s)
AUDIT_DIR="_audit/${TIMESTAMP}_urai_jobs_full_system_audit"
BACKUP_DIR="${AUDIT_DIR}/backups"
PROOF_DIR="${AUDIT_DIR}/proof"

mkdir -p "$BACKUP_DIR"
mkdir -p "$PROOF_DIR"

# Files to be modified
FILES_TO_FIX=(
  "workers/narrator-worker/src/index.ts"
  "workers/narrator-worker/src/handlers/index.ts"
  "web/src/App.tsx"
  "web/src/pages/CreateJobPage.tsx"
  "web/src/pages/AdminPage.tsx"
)

# Create backups
for file in "${FILES_TO_FIX[@]}"; do
  cp "$file" "${BACKUP_DIR}/$(basename "$file").bak"
done

# --- Surgical Fixes ---

# 1. Fix broken imports in narrator-worker
echo "Fixing broken imports in narrator-worker..."
# Proof before
cp workers/narrator-worker/src/index.ts "${PROOF_DIR}/index.ts.before"
sed -i "s|'./handlers.js.js.js.js'|'./handlers.js'|" workers/narrator-worker/src/index.ts
# Proof after
cp workers/narrator-worker/src/index.ts "${PROOF_DIR}/index.ts.after"

# Proof before
cp workers/narrator-worker/src/handlers/index.ts "${PROOF_DIR}/handlers_index.ts.before"
sed -i "s|'./narrator-tts.js.js.js.js'|'./narrator-tts.js'|" workers/narrator-worker/src/handlers/index.ts
# Proof after
cp workers/narrator-worker/src/handlers/index.ts "${PROOF_DIR}/handlers_index.ts.after"

# 2. Fix web frontend
echo "Fixing web frontend..."

# Update welcome message and add sign-out button in App.tsx
# Proof before
cp web/src/App.tsx "${PROOF_DIR}/App.tsx.before"
sed -i 's|Welcome to URAI Studio|Welcome to URAI Jobs|' web/src/App.tsx
sed -i '/{\\/* Add a sign-out button here *\\/}/c\\          | <button onClick={() => auth.signOut()}>Sign Out</button>\' web/src/App.tsx
# Proof after
cp web/src/App.tsx "${PROOF_DIR}/App.tsx.after"


# Update CreateJobPage.tsx to match backend API
# Proof before
cp web/src/pages/CreateJobPage.tsx "${PROOF_DIR}/CreateJobPage.tsx.before"
cat << 'EOF' > web/src/pages/CreateJobPage.tsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { functions } from '../firebase'; // Assuming you have a firebase config file that exports functions
import { httpsCallable } from 'firebase/functions';

export function CreateJobPage() {
  const { tokenResult } = useAuth();
  const [jobType, setJobType] = useState('narrator.tts');
  const [payload, setPayload] = useState('{\\n  "text": "Hello, world!",\\n  "voice": "en-US-Wavenet-D",\\n  "locale": "en-US",\\n  "format": "mp3"\\n}');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (!tokenResult) {
      setError('You must be logged in to create a job.');
      setIsLoading(false);
      return;
    }

    try {
      const createJob = httpsCallable(functions, 'createJob');
      const response = await createJob({
        jobType,
        payload: JSON.parse(payload),
      });

      const responseData = response.data as { jobId: string };
      setSuccess(`Job created successfully! Job ID: ${responseData.jobId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>Create a New Job</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="jobType">Job Type:</label>
          <input
            id="jobType"
            type="text"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="payload">Payload (JSON):</label>
          <textarea
            id="payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            required
            rows={10}
            style={{ fontFamily: 'monospace', width: '100%' }}
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Job'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
    </div>
  );
}
EOF
# Proof after
cp web/src/pages/CreateJobPage.tsx "${PROOF_DIR}/CreateJobPage.tsx.after"


# Add a note to AdminPage.tsx
# Proof before
cp web/src/pages/AdminPage.tsx "${PROOF_DIR}/AdminPage.tsx.before"
cat << 'EOF' > web/src/pages/AdminPage.tsx
import React from 'react';

export function AdminPage() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>This is a protected admin page.</p>
      <p><em>Note: This page is a placeholder. Full implementation is pending.</em></p>
      {/* Future admin-specific components will go here */}
    </div>
  );
}
EOF
# Proof after
cp web/src/pages/AdminPage.tsx "${PROOF_DIR}/AdminPage.tsx.after"


# --- Verification ---
echo "Verifying fixes..."

# Install dependencies and build functions
echo "Building functions..."
(cd functions && npm install && npm run build)

# Install dependencies and build web
echo "Building web..."
(cd web && npm install && npm run build)

# Install dependencies and build narrator-worker
echo "Building narrator-worker..."
(cd workers/narrator-worker && npm install && npm run build)


# --- Reporting ---
echo "Generating audit report..."
REPORT_PATH="${AUDIT_DIR}/REPORT.md"
cat << EOF > "$REPORT_PATH"
# Audit Report and Fixes for urai-jobs

## 1. Audit Findings

A comprehensive audit of the \`urai-jobs\` project was conducted. The key findings are:

*   **Backend:** The \`functions\` workspace is well-structured with a robust, transaction-based architecture. However, the system relies on a set of workers to execute jobs, and these were found to be in a broken state.
*   **Workers:** The \`workers\` directory contains several worker implementations, but the \`narrator-worker\` has broken import statements, rendering it non-functional.
*   **Frontend:** The \`web\` workspace is a React/Vite SPA with a clear structure, but it is largely a collection of stubs and partially implemented features.
    *   The welcome message was incorrect.
    *   A sign-out feature was missing.
    *   The "Create Job" page was not aligned with the backend API.
    *   The "Admin Page" is a placeholder.

## 2. Fixes Applied

The following fixes have been applied to the codebase:

*   **\`workers/narrator-worker\`:** Corrected broken import statements in \`src/index.ts\` and \`src/handlers/index.ts\`.
*   **\`web/src/App.tsx\`:**
    *   Updated the welcome message to "Welcome to URAI Jobs".
    *   Added a functional sign-out button.
*   **\`web/src/pages/CreateJobPage.tsx\`:**
    *   The form has been updated to accept a "Job Type" and a JSON "Payload", aligning it with the backend \`createJob\` function.
    *   The API call now uses the Firebase Functions SDK's \`httpsCallable\` for a more robust integration.
*   **\`web/src/pages/AdminPage.tsx\`:** A note has been added to the page to indicate that it is a placeholder.

## 3. Verification

*   All modified workspaces (\`functions\`, \`web\`, \`workers/narrator-worker\`) have had their dependencies installed and have been successfully built.
*   Proof of all changes (before and after) are available in the \`${PROOF_DIR}\` directory.

## 4. Conclusion

The \`urai-jobs\` project is now in a buildable and more functional state. The critical import errors have been resolved, and the frontend has been brought into closer alignment with the backend. Further work is needed to fully implement the admin dashboard and other features, but the foundational issues discovered during the audit have been addressed.

EOF

echo "Audit and fix process complete. Report and backups are in ${AUDIT_DIR}"
