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

      const directory = await unzipper.Open.file(zipPath);
      const gridFile = directory.files.find((file) =>
        file.path.endsWith('.grid'),
      );

      if (!gridFile) {
        return res.status(400).send('No .grid file found in ZIP');
      }

      const gridBuffer = await gridFile.buffer();

      const headerOffset = 128;
      const gridDataBuffer = gridBuffer.slice(headerOffset);

      const gridData = new Int16Array(
        gridDataBuffer.buffer,
        gridDataBuffer.byteOffset,
        gridDataBuffer.byteLength / Int16Array.BYTES_PER_ELEMENT,
      );

      console.log('First few grid data values:', gridData.slice(0, 10));

      let minTemp = Infinity;
      let maxTemp = -Infinity;

      for (let i = 0; i < gridData.length; i++) {
        const temp = gridData[i];
        if (temp < minTemp) minTemp = temp;
        if (temp > maxTemp) maxTemp = temp;
      }

      const mapImage = await loadImage(mapPath);

      const canvas = createCanvas(mapImage.width, mapImage.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(mapImage, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4;
          const tempIndex = y * canvas.width + x;

          if (tempIndex < gridData.length) {
            const temp = gridData[tempIndex];
            const color = getColorForTemperature(temp, minTemp, maxTemp);

            const isWater =
              data[index + 2] > data[index] &&
              data[index + 2] > data[index + 1];

            if (isWater) {
              data[index] = color.r;
              data[index + 1] = color.g;
              data[index + 2] = color.b;
            }
          }
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
  if (temp === -999 || isNaN(temp)) {
    return { r: 0, g: 0, b: 0 };
  }

  const ratio = (temp - minTemp) / (maxTemp - minTemp);
  const r = Math.floor(255 * Math.min(1, ratio * 2));
  const g = Math.floor(255 * (1 - Math.abs(ratio - 0.5) * 2));
  const b = Math.floor(255 * Math.min(1, (1 - ratio) * 2));

  return { r, g, b };
}

function cleanUploadsFolder() {
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
