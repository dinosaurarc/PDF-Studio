const fsp = require("node:fs/promises");

async function writeSourceFile(filePath, data) {
  const handle = await fsp.open(filePath, "w");
  try {
    await handle.writeFile(Buffer.from(data));
    await handle.sync();
  } finally {
    await handle.close();
  }
}

module.exports = { writeSourceFile };
