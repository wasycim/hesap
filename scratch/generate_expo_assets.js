const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "public", "iconw.png");
const assetsDir = path.join(root, "expo-go", "assets");

async function run() {
  await fs.promises.mkdir(assetsDir, { recursive: true });

  console.log("Generating expo-go assets from public/iconw.png...");
  await sharp(source).resize(1024, 1024, { fit: "cover" }).png().toFile(path.join(assetsDir, "icon.png"));
  await sharp(source).resize(1024, 1024, { fit: "cover" }).png().toFile(path.join(assetsDir, "adaptive-icon.png"));
  await sharp(source).resize(512, 512, { fit: "cover" }).png().toFile(path.join(assetsDir, "logo.png"));
  await sharp(source).resize(2048, 2048, { fit: "cover" }).png().toFile(path.join(assetsDir, "splash.png"));

  console.log("Expo assets successfully generated under expo-go/assets!");
}

run().catch((err) => {
  console.error("Error generating expo assets:", err);
  process.exit(1);
});
