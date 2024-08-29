import express from 'express';
import multer from 'multer';
import unzipper from 'unzipper';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
);

app.post(
  '/upload',
  upload.fields([{ name: 'map' }, { name: 'zip' }]),
  async (req, res) => {
    try {
      const files = req.files as Partial<Record<string, Express.Multer.File[]>>; //because Typescript couldn't infer the types of req.files
      const mapFile = files['map']?.[0];
      const zipFile = files['zip']?.[0];

      if (!mapFile || !zipFile) {
        return res.status(400).send('Files are missing');
      }

      const mapPath = mapFile.path;
      const zipPath = zipFile.path;

      // Unzipping the zip archive
      const directory = await unzipper.Open.file(zipPath);
      const gridFile = directory.files.find((file) =>
        file.path.endsWith('.grid'),
      );

      if (!gridFile) {
        return res.status(400).send('No .grid file found in ZIP');
      }

      const gridBuffer = await gridFile.buffer();
      const gridData = new Uint8Array(gridBuffer);

      let minTemp = Infinity;
      let maxTemp = -Infinity;

      for (let i = 0; i < gridData.length; i++) {
        const temp = gridData[i];
        if (temp < minTemp) minTemp = temp;
        if (temp > maxTemp) maxTemp = temp;
      }

      const ORIGINAL_WIDTH = 36000;
      const ORIGINAL_HEIGHT = 17999;
      const SCALE_FACTOR = 0.5; // Scale image down to 10%, because it is too big
      const CANVAS_WIDTH = Math.round(ORIGINAL_WIDTH * SCALE_FACTOR);
      const CANVAS_HEIGHT = Math.round(ORIGINAL_HEIGHT * SCALE_FACTOR);
      const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
      const ctx = canvas.getContext('2d');
      const mapImage = await loadImage(mapPath);

      ctx.drawImage(mapImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Color the map based on the grid file data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let y = 0; y < CANVAS_HEIGHT; y++) {
        for (let x = 0; x < CANVAS_WIDTH; x++) {
          const origX = Math.floor(x / SCALE_FACTOR);
          const origY = Math.floor(y / SCALE_FACTOR);
          const temp = gridData[origY * ORIGINAL_WIDTH + origX];
          const color = getColorForTemperature(temp, minTemp, maxTemp);
          const index = (y * CANVAS_WIDTH + x) * 4;
          data[index] = color.r;
          data[index + 1] = color.g;
          data[index + 2] = color.b;
          data[index + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const outputDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const outputPath = path.join(outputDir, 'output.png');
      const out = fs.createWriteStream(outputPath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);

      out.on('finish', () => {
        res.sendFile(outputPath, (err) => {
          if (err) {
            console.error('Error sending file:', err);
            res.status(500).send('Error sending output image');
          } else {
            cleanUploadsFolder(); //I did this logic, because file got deleted before sent often
          }
        });
      });

      out.on('error', (error) => {
        console.error('Error writing output image:', error);
        res.status(500).send('Error writing output image');
      });
    } catch (error) {
      console.error('Error processing files:', error);
      res.status(500).send('Internal Server Error');
    }
  },
);

function getColorForTemperature(
  temp: number,
  minTemp: number,
  maxTemp: number,
) {
  const ratio = (temp - minTemp) / (maxTemp - minTemp);
  const r = Math.floor(255 * ratio); // From blue to red
  const g = Math.floor(255 * (1 - ratio)); // From blue to red
  const b = Math.floor(255 * (1 - ratio)); // From blue to red
  return { r, g, b };
}

function cleanUploadsFolder() {
  //to clear files in uploads folder
  const directory = 'uploads';
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), (err) => {
        if (err) throw err;
      });
    }
  });
}

app.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});
