#!/bin/bash
# =============================================================================
# HHS PhotoHub — Local Build + Deploy to Azure App Service
# =============================================================================
# Builds the Next.js standalone app locally and deploys via Kudu ZipDeploy
# using publishing profile credentials. No GitHub Actions required.
#
# Prerequisites:
#   1. Node 22+ and npm installed
#   2. Python 3 installed (for ZIP creation — PowerShell ZIPs break on Linux)
#   3. az login (authenticated) OR publishing profile creds cached
#   4. PIM: Activate Contributor on OCIO-OPS-APPServices
#   5. Infrastructure already provisioned (setup-afd-app.sh)
#
# Usage:
#   ./scripts/deploy-app.sh                # full build + deploy
#   ./scripts/deploy-app.sh --skip-build   # deploy existing build
# =============================================================================

set -euo pipefail
export MSYS_NO_PATHCONV=1

APP_NAME="app-aspr-photos"
RG="rg-ocio-microsites-eus2-01"
AFD_PROFILE="cdn-ociomicro-premium-eus2-01"
AFD_ENDPOINT="cdn-asprphotos-app"
DEPLOY_DIR=".next/standalone"
DEPLOY_ZIP="deploy.zip"

# Parse flags
SKIP_BUILD=false
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
  esac
done

echo "============================================================"
echo "  HHS PhotoHub — Build & Deploy"
echo "  Target: $APP_NAME"
echo "============================================================"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Step 1 — Build
# ═══════════════════════════════════════════════════════════════════
if [ "$SKIP_BUILD" = false ]; then
  echo "=== Step 1: Install dependencies ==="
  npm ci

  echo ""
  echo "=== Step 2: Build Next.js (standalone) ==="
  npm run build

  echo ""
  echo "=== Step 3: Assemble deploy package ==="
  cp -r .next/static "$DEPLOY_DIR/.next/static"
  cp -r public "$DEPLOY_DIR/public"
  echo "  Standalone directory assembled."
else
  echo "=== Skipping build (--skip-build) ==="
  if [ ! -d "$DEPLOY_DIR" ]; then
    echo "  ERROR: $DEPLOY_DIR does not exist. Run without --skip-build first."
    exit 1
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# Step 4 — Create ZIP (must use Python — PowerShell ZIPs use
#          backslash paths that break on Linux App Service)
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== Step 4: Create deployment ZIP ==="

rm -f "$DEPLOY_ZIP"

# Get absolute paths for Python
ABS_DEPLOY=$(cd "$DEPLOY_DIR" && pwd -W 2>/dev/null || pwd)
ABS_ZIP=$(cd "$(dirname "$DEPLOY_ZIP")" && pwd -W 2>/dev/null || pwd)/$(basename "$DEPLOY_ZIP")

python -c "
import zipfile, os
src = r'${ABS_DEPLOY}'
dst = r'${ABS_ZIP}'
count = 0
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        for f in files:
            full = os.path.join(root, f)
            arcname = os.path.relpath(full, src).replace(os.sep, '/')
            zf.write(full, arcname)
            count += 1
sz = os.path.getsize(dst)
print(f'  Created deploy.zip: {sz / 1024 / 1024:.1f} MB, {count} files')
"

# ═══════════════════════════════════════════════════════════════════
# Step 5 — Deploy via Kudu ZipDeploy (publishing profile)
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== Step 5: Deploy to Azure App Service ==="

# Get publishing credentials
echo "  Fetching publishing profile..."
CREDS=$(az webapp deployment list-publishing-profiles \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --query "[?publishMethod=='MSDeploy'].[userName,userPWD]" \
  --output tsv)

KUDU_USER=$(echo "$CREDS" | cut -f1)
KUDU_PASS=$(echo "$CREDS" | cut -f2)

echo "  Deploying via Kudu ZipDeploy..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null \
  -X POST "https://${APP_NAME}.scm.azurewebsites.net/api/zipdeploy" \
  -u "${KUDU_USER}:${KUDU_PASS}" \
  --data-binary @"$DEPLOY_ZIP" \
  -H "Content-Type: application/zip")

if [ "$HTTP_CODE" = "200" ]; then
  echo "  Deployment succeeded (HTTP $HTTP_CODE)"
else
  echo "  ERROR: Deployment returned HTTP $HTTP_CODE"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════
# Step 6 — Verify
# ═══════════════════════════════════════════════════════════════════
echo ""
echo "=== Step 6: Verify deployment ==="

AFD_HOSTNAME=$(az afd endpoint show \
  --resource-group "$RG" \
  --profile-name "$AFD_PROFILE" \
  --endpoint-name "$AFD_ENDPOINT" \
  --query "hostName" -o tsv 2>/dev/null || echo "")

if [ -n "$AFD_HOSTNAME" ]; then
  echo "  Waiting 20s for app restart..."
  sleep 20
  echo "  Checking health endpoint..."
  HEALTH=$(curl -sk -o /dev/null -w "%{http_code}" "https://${AFD_HOSTNAME}/api/health" 2>/dev/null || echo "000")
  if [ "$HEALTH" = "200" ]; then
    echo "  Health check PASSED (HTTP 200)"
  else
    echo "  Health check returned HTTP $HEALTH (may need more time)"
  fi
  echo ""
  echo "  App URL: https://$AFD_HOSTNAME"
else
  echo "  AFD endpoint not found — verify manually."
  echo "  Direct: https://${APP_NAME}.azurewebsites.net/api/health"
fi

# Clean up
rm -f "$DEPLOY_ZIP"

echo ""
echo "============================================================"
echo "  Deploy complete!"
echo "============================================================"
