const fs = require("node:fs");
const path = require("node:path");
const { notarize } = require("@electron/notarize");

module.exports = async function notarizeApp(context) {
  if (process.platform !== "darwin") {
    return;
  }

  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (!appleApiKey || !appleApiKeyId || !appleApiIssuer) {
    console.log("Skipping notarization: APPLE_API_KEY, APPLE_API_KEY_ID, or APPLE_API_ISSUER is not set.");
    return;
  }

  if (!fs.existsSync(appleApiKey)) {
    throw new Error(`APPLE_API_KEY does not point to an existing file: ${appleApiKey}`);
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  console.log(`Notarizing ${appPath}`);

  await notarize({
    appPath,
    appleApiKey,
    appleApiKeyId,
    appleApiIssuer,
  });
};
