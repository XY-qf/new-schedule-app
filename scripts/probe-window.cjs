const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const w = new BrowserWindow({ width: 400, height: 300, show: false });
  w.loadURL('about:blank');
  w.once('ready-to-show', () => {
    console.log('WINDOW_OK bounds=' + JSON.stringify(w.getContentBounds()));
    app.quit();
  });
  setTimeout(() => { console.log('WINDOW_TIMEOUT'); app.quit(); }, 5000);
});