// Render the vector master using the Chromium version bundled with the app.
// Run with `npm run icons` after changing assets/playgen-icon.svg.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets');
app.setPath('userData', path.join(root, 'build', 'icon-cache'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, backgroundThrottling: false }
  });

  try {
    await window.loadURL('data:text/html,<html><body></body></html>');
    const svg = fs.readFileSync(path.join(assets, 'playgen-icon.svg')).toString('base64');
    const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
    const images = await window.webContents.executeJavaScript(`(async () => {
      const image = new Image();
      image.src = 'data:image/svg+xml;base64,${svg}';
      await image.decode();
      return ${JSON.stringify(sizes)}.map(size => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        canvas.getContext('2d').drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      });
    })()`);

    fs.mkdirSync(path.join(assets, 'playgen-icon'), { recursive: true });
    const pngs = images.map(data => Buffer.from(data, 'base64'));
    sizes.forEach((size, index) => {
      fs.writeFileSync(path.join(assets, 'playgen-icon', `${size}x${size}.png`), pngs[index]);
    });
    fs.writeFileSync(path.join(assets, 'playgen-icon.png'), pngs[sizes.indexOf(512)]);

    // ICO supports PNG frames; retain every Windows size through 256px.
    const frames = sizes.filter(size => size <= 256);
    const header = Buffer.alloc(6 + frames.length * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(frames.length, 4);
    let offset = header.length;
    frames.forEach((size, index) => {
      const entry = 6 + index * 16;
      header[entry] = header[entry + 1] = size === 256 ? 0 : size;
      header.writeUInt16LE(1, entry + 4);
      header.writeUInt16LE(32, entry + 6);
      header.writeUInt32LE(pngs[index].length, entry + 8);
      header.writeUInt32LE(offset, entry + 12);
      offset += pngs[index].length;
    });
    fs.writeFileSync(path.join(assets, 'playgen-icon.ico'), Buffer.concat([header, ...pngs.slice(0, frames.length)]));
    console.log(`Generated ${sizes.length} PNG sizes and the Windows ICO from playgen-icon.svg.`);
  } finally {
    window.destroy();
    app.quit();
  }
}).catch(error => {
  console.error(error);
  app.exit(1);
});
