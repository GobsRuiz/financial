const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const dbHandler = require('./db-handler')

const isDev = process.env.NODE_ENV !== 'production'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0e1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true,
  })

  if (isDev) {
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools()
  } else {
    // Em build packaged: extraResources/public
    // Em build local (sem package): ../client/.output/public
    const packaged = app.isPackaged
    const publicDir = packaged
      ? path.join(process.resourcesPath, 'public')
      : path.join(__dirname, '..', 'client', '.output', 'public')
    win.loadFile(path.join(publicDir, 'index.html'))
  }
}

// Inicializa o db-handler antes de criar a janela
app.whenReady().then(() => {
  dbHandler.init(app.getPath('userData'), isDev, app.isPackaged ? process.resourcesPath : null)

  // Registra handlers IPC
  ipcMain.handle('db:get', (_event, urlPath, params) => {
    return dbHandler.handleGet(urlPath, params)
  })

  ipcMain.handle('db:post', (_event, urlPath, body) => {
    return dbHandler.handlePost(urlPath, body)
  })

  ipcMain.handle('db:patch', (_event, urlPath, body) => {
    return dbHandler.handlePatch(urlPath, body)
  })

  ipcMain.handle('db:delete', (_event, urlPath) => {
    return dbHandler.handleDelete(urlPath)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
