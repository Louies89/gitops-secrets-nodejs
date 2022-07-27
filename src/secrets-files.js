const fs = require("fs");
const path = require("path");
const secrets = require("./secrets.js");

const SECRETS_FOLDER = path.join(__dirname, "../.secrets");
const DEFAULT_JS_PATH = path.join(SECRETS_FOLDER, ".secrets.enc.js");
const DEFAULT_FILE_PATH = path.join(SECRETS_FOLDER, ".secrets.enc.json");

// eslint-disable-next-line security/detect-non-literal-fs-filename
// if (!fs.existsSync(SECRETS_FOLDER)) {
//   // eslint-disable-next-line security/detect-non-literal-fs-filename
//   fs.mkdirSync(SECRETS_FOLDER);
// }

/**
 * Encapsulate encrypted secrets in a JS module for easy runtime access.
 * Use {options.path} to output module locally for when package level storage or non-literal imports are disallowed.
 * Use {options.cipherTextOnly} to limit the JS file to only exporting `CIPHER_TEXT`
 * @param {<Record<string, any>} payload
 * @param {{path: string, cipherTextOnly: boolean}} [options={path: null, cipherTextOnly: false}]
 */
async function build(payload, options = { path: null, cipherTextOnly: false }) {
  const cipherText = secrets.encrypt(payload);
  const filePath = options.path ? path.resolve(options.path) : DEFAULT_JS_PATH;
  const packageType = process.env.npm_package_type === "module" ? "esm" : "cjs";
  const format = filePath === DEFAULT_JS_PATH ? "cjs" : packageType;
  let lines = ["/* eslint-disable */", "// This file was auto-generated by gitops-secrets"];

  if (format === "esm") {
    if (!options.cipherTextOnly) {
      lines = [
        ...lines,
        `import secrets from "gitops-secrets/no-fs";`,
        `const CIPHER_TEXT = "${cipherText}";`,
        "const loadSecrets = () => secrets.loadSecretsFromCipher(CIPHER_TEXT);",
        "export { CIPHER_TEXT, loadSecrets };",
      ];
    } else {
      lines = [...lines, `const CIPHER_TEXT = "${cipherText}";`, "export { CIPHER_TEXT };"];
    }
  }

  if (format === "cjs") {
    if (!options.cipherTextOnly) {
      lines = [
        ...lines,
        `const secrets = require("gitops-secrets/no-fs");`,
        `const CIPHER_TEXT = "${cipherText}";`,
        "const loadSecrets = () => secrets.loadSecretsFromCipher(CIPHER_TEXT);",
        "module.exports = { CIPHER_TEXT, loadSecrets };",
      ];
    } else {
      lines = [...lines, `const CIPHER_TEXT = "${cipherText}";`, "module.exports = { CIPHER_TEXT };"];
    }
  }

  writeFile(filePath, lines.join("\n"));
}

/**
 * Encrypt JSON-serializable payload to a static file
 * @param {Record<string,any>} payload
 * @param {{path: string}} [options={ path: null }]
 */
function encryptToFile(payload, options = { path: null }) {
  const cipherText = secrets.encrypt(payload);
  const filePath = options.path ? path.resolve(options.path) : DEFAULT_FILE_PATH;
  writeFile(filePath, cipherText);
}

/**
 * Decrypt JSON payload to object with option to merge with process.env
 * @param {string} filePath
 * @returns
 */
function decryptFromFile(filePath) {
  filePath = filePath ? path.resolve(filePath) : DEFAULT_FILE_PATH;

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const payload = secrets.decrypt(fs.readFileSync(filePath, { encoding: "utf-8" }));
    return { ...payload, populateEnv: () => secrets.populateEnv(payload) };
  } catch (error) {
    throw new Error(`Unable to read secrets from ${filePath}: ${error}`);
  }
}

function writeFile(filePath, fileContents) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(filePath, fileContents, { encoding: "utf-8" });
  } catch (error) {
    throw new Error(`Unable to write secrets to ${filePath}: ${error}`);
  }
}

function loadSecrets() {
  // eslint-disable-next-line security/detect-non-literal-require
  return require(DEFAULT_JS_PATH).loadSecrets();
}

module.exports = {
  build: build,
  encryptToFile: encryptToFile,
  decryptFromFile: decryptFromFile,
  loadSecrets: loadSecrets,
  DEFAULT_JS_PATH: DEFAULT_JS_PATH,
  DEFAULT_FILE_PATH: DEFAULT_FILE_PATH,
};
