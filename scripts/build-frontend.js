const fs = require('fs');
const path = require('path');
const terser = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

async function build() {
  const sourcePath = path.join(process.cwd(), 'private', 'frontend', 'app.js');
  const outputPath = path.join(process.cwd(), 'frontend', 'assets', 'js', 'app.min.js');
  const source = await fs.promises.readFile(sourcePath, 'utf8');
  const result = await terser.minify(source, {
    compress: {
      passes: 3,
      drop_console: true,
      drop_debugger: true
    },
    mangle: {
      toplevel: true
    },
    format: {
      comments: false
    },
    sourceMap: false
  });

  if (result.error) {
    throw result.error;
  }

  const obfuscated = JavaScriptObfuscator.obfuscate(result.code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.35,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 8,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.6,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 1,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  }).getObfuscatedCode();

  await fs.promises.writeFile(outputPath, obfuscated, 'utf8');
  console.log(`Frontend minificado y ofuscado: ${path.relative(process.cwd(), outputPath)}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
