import express from "express";
import multer from "multer";
import unzipper from "unzipper";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post(
  "/upload",
  upload.fields([{ name: "map" }, { name: "zip" }]),
  async (req, res) => {
    try {
      const mapPath = req.files?.["map"][0]?.path;
      const zipPath = req.files?.["zip"][0]?.path;

      if (!mapPath || !zipPath) {
        return res.status(400).send("Files are missing");
      }

      // Розпакування zip-архіву
      const directory = await unzipper.Open.file(zipPath);
      const gridFile = directory.files.find((file) =>
        file.path.endsWith(".grid")
      );

      if (!gridFile) {
        return res.status(400).send("No .grid file found in ZIP");
      }

      const gridBuffer = await gridFile.buffer();
      const gridData = new Uint8Array(gridBuffer);

      const canvas = createCanvas(36000, 17999);
      const ctx = canvas.getContext("2d");
      const mapImage = await loadImage(mapPath);

      ctx.drawImage(mapImage, 0, 0, 36000, 17999);

      // Розфарбовування карти на основі даних із grid файлу
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let y = 0; y < 17999; y++) {
        for (let x = 0; x < 36000; x++) {
          const temp = gridData[y * 36000 + x];
          const color = getColorForTemperature(temp); // Функція, яка визначає колір на основі температури
          const index = (y * 36000 + x) * 4;
          data[index] = color.r;
          data[index + 1] = color.g;
          data[index + 2] = color.b;
          data[index + 3] = 255; // Прозорість
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const outputPath = path.join("uploads", "output.png");
      const out = fs.createWriteStream(outputPath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);

      out.on("finish", () => {
        res.sendFile(path.resolve(outputPath));
      });
    } catch (error) {
      res.status(500).send("Error processing files");
    }
  }
);

function getColorForTemperature(temp: number) {
  if (temp < 32) return { r: 0, g: 0, b: 255 }; // холодний
  if (temp < 60) return { r: 0, g: 255, b: 0 }; // теплий
  return { r: 255, g: 0, b: 0 }; // гарячий
}

app.listen(5000, () => {
  console.log("Server is running on http://localhost:5000");
});
