#!/bin/bash
set -eou pipefail

# --- Configuration ---
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/urai_jobs_finish_${TIMESTAMP}.log"
PROJECT_ID="urai-jobs"
FIREBASE_PROJECT_ARG="--project ${PROJECT_ID}"

# --- Logging ---
# Redirect stdout and stderr to a log file and to the console.
exec &> >(tee -a "${LOG_FILE}")

echo "--- URAI-JOBS FINISHER SCRIPT ---"
echo "Full log available at: ${LOG_FILE}"
echo "Timestamp: ${TIMESTAMP}"

# --- 1. Preflight Checks ---
echo ""
echo "--- [1/7] Running Preflight Checks ---"
# Check for required command-line tools
for cmd in pnpm firebase jq; do
  if ! command -v $cmd &> /dev/null; then
    echo "❌ ERROR: Required command '$cmd' not found. Please install it and ensure it's in your PATH."
    exit 1
  fi
done
echo "✅ Required tools (pnpm, firebase, jq) are installed."

# Check for Firebase login status
if ! firebase login:list | grep -q "Logged in as"; then
    echo "❌ ERROR: Not logged into Firebase. Please run 'firebase login'."
    exit 1
fi
echo "✅ Logged into Firebase."

# Check for .firebaserc and correct project configuration
if [ ! -f ".firebaserc" ]; then
    echo "❌ ERROR: .firebaserc file not found."
    echo "Please set up your Firebase project association by running:"
    echo "  firebase use --add"
    echo "Then select the '${PROJECT_ID}' project and re-run this script."
    exit 1
fi
echo "✅ .firebaserc found."

# Verify access to the specified Firebase project
echo "Verifying access to Firebase project '${PROJECT_ID}'..."
if ! firebase projects:list | grep -q "${PROJECT_ID}"; then
    echo "❌ ERROR: Project '${PROJECT_ID}' not found in your accessible projects."
    echo "Please ensure you have access to this project in the Firebase Console."
    exit 1
fi
firebase use "${PROJECT_ID}"
echo "✅ Access to Firebase project '${PROJECT_ID}' confirmed."


# --- 2. File System Preparation & Patching ---
echo ""
echo "--- [2/7] Preparing Filesystem and Patching ---"
# Create a backup of firebase.json and patch it.
# The original file contains invalid JSON in the predeploy hooks.
if grep -q '"pnpm --prefix \"' firebase.json; then
    echo "Patching 'firebase.json' to fix predeploy script quotes..."
    cp firebase.json "firebase.json.bak.${TIMESTAMP}"
    # Use a temp file for cross-platform sed compatibility
    sed 's/"pnpm --prefix \\"\$RESOURCE_DIR\\" run lint"/"pnpm --prefix $RESOURCE_DIR run lint"/' firebase.json > firebase.json.tmp
    mv firebase.json.tmp firebase.json
    sed 's/"pnpm --prefix \\"\$RESOURCE_DIR\\" run build"/"pnpm --prefix $RESOURCE_DIR run build"/' firebase.json > firebase.json.tmp
    mv firebase.json.tmp firebase.json
    echo "✅ 'firebase.json' patched successfully. Backup created at firebase.json.bak.${TIMESTAMP}"
else
    echo "✅ 'firebase.json' does not require patching."
fi

# --- 3. Install Dependencies ---
echo ""
echo "--- [3/7] Installing Project Dependencies ---"
# Clean previous build artifacts and install fresh dependencies
rm -rf functions/lib public web/dist node_modules pnpm-lock.yaml
pnpm install
echo "✅ Dependencies installed successfully."

# --- 4. Build Project ---
echo ""
echo "--- [4/7] Building Workspace (web & functions) ---"
pnpm --filter web build
pnpm --filter functions build

# Verify that the build output for the web app exists
if [ ! -f "public/index.html" ]; then
    echo "❌ ERROR: Build failed. 'public/index.html' not found after build."
    echo "Please check the 'web' workspace build configuration."
    exit 1
fi
echo "✅ Project built successfully. Frontend assets are in '/public'."

# --- 5. Deploy to Firebase ---
echo ""
echo "--- [5/7] Deploying to Firebase ---"
DEPLOY_LOG=$(mktemp)
# Deploy all specified resources, forcing the action for CI environments.
firebase deploy ${FIREBASE_PROJECT_ARG} --only hosting,functions,firestore,storage --force 2>&1 | tee ${DEPLOY_LOG}

# Verify deploy command reported success
if ! grep -q "Deploy complete!" "${DEPLOY_LOG}"; then
    echo "❌ ERROR: Firebase deployment command failed. See log for details: ${LOG_FILE}"
    exit 1
fi
echo "✅ Firebase deployment command completed."

# --- 6. Post-Deploy Smoke Test ---
echo ""
echo "--- [6/7] Running Post-Deploy Smoke Test ---"
HOSTING_URL=$(grep "Hosting URL:" "${DEPLOY_LOG}" | awk '{print $3}')

if [ -z "${HOSTING_URL}" ]; then
    echo "❌ ERROR: Could not determine deployed Hosting URL from deploy output."
    exit 1
fi

HEALTH_URL="${HOSTING_URL}/api/health"

echo "Deployed Site URL: ${HOSTING_URL}"
echo "Testing Health Endpoint: ${HEALTH_URL}"
echo "Waiting 5 seconds for function to be available..."
sleep 5

if curl -sfL "${HEALTH_URL}" > /dev/null; then
    echo "✅ Health check PASSED. Endpoint returned success."
    echo "Endpoint response:"
    curl -L "${HEALTH_URL}"
    echo ""
else
    echo "❌ ERROR: Health check FAILED for ${HEALTH_URL}."
    echo "--- DEPLOYMENT FAILED ---"
    exit 1
fi

# --- 7. Summary ---
echo ""
echo "--- [7/7] Summary ---"
echo "✅ All steps completed successfully."
echo ""
echo "--- DEPLOYMENT RESULTS ---"
echo -e "| Gate                  | Status |\n|-----------------------|--------|"
echo -e "| Project Access        | ✅ PASS  |\n| Dependencies          | ✅ PASS  |\n| Build                 | ✅ PASS  |\n| Deploy                | ✅ PASS  |\n| Smoke Test (Health)   | ✅ PASS  |"
echo ""
echo "Deployed Site URL: ${HOSTING_URL}"
echo ""
echo "LOG=${LOG_FILE}"
echo "STATUS=OK"
exit 0
