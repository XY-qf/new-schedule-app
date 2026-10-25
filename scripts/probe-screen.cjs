const { app, BrowserWindow, screen } = require('electron');
app.whenReady().then(() => {
  const d = screen.getPrimaryDisplay();
  const w = new BrowserWindow({ width: 1000, height: 700, show: false });
  console.log('SCREEN ' + JSON.stringify({
    workArea: d.workArea,
    size: d.size,
    scaleFactor: d.scaleFactor,
    actual: w.getContentBounds(),
    bounds: w.getBounds(),
  }));
  app.quit();
});