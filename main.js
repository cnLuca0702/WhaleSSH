const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const Store = require('electron-store');
const { Client } = require('ssh2');
const fs = require('fs');

let store;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // Mac-like hidden title bar
    title: 'WhaleSSH',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');

  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.name = 'WhaleSSH';
    try {
      app.dock.setIcon(path.join(__dirname, 'icon.png'));
    } catch (e) { }
  }
  const StoreModule = await import('electron-store');
  const Store = StoreModule.default || StoreModule;
  store = new Store({
    defaults: {
      connections: [],
      snippets: []
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for Store (Connections & Snippets)
ipcMain.handle('get-data', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-data', (event, key, value) => {
  store.set(key, value);
  return true;
});

// Select SSH Key File
ipcMain.handle('select-key-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select SSH Private Key'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// SSH Session Management
const activeSessions = new Map(); // tabId -> ssh Client

ipcMain.handle('ssh-connect', async (event, config, tabId) => {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    // Setup connection options
    const connectConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      keepaliveInterval: 10000, // 10 seconds Keep-Alive
    };

    if (config.authType === 'password') {
      connectConfig.password = config.password;
    } else if (config.authType === 'key') {
      try {
        connectConfig.privateKey = fs.readFileSync(config.privateKeyPath);
      } catch (err) {
        return reject(`Failed to load private key: ${err.message}`);
      }
    } else {
      return reject('Unknown auth type');
    }

    conn.on('ready', () => {
      conn.shell({ term: 'xterm-color', rows: 24, cols: 80 }, (err, stream) => {
        if (err) {
          conn.end();
          return reject(`Shell error: ${err.message}`);
        }

        activeSessions.set(tabId, { conn, stream });

        // Handle incoming data
        stream.on('data', (data) => {
          // Send raw string so xterm can render it directly
          mainWindow.webContents.send(`ssh-data-${tabId}`, data.toString('utf-8'));
        }).on('close', () => {
          mainWindow.webContents.send(`ssh-closed-${tabId}`);
          conn.end();
          activeSessions.delete(tabId);
        });

        // Set encoding to utf-8 so text interacts smoothly
        stream.setEncoding('utf-8');

        resolve();
      });
    });

    conn.on('error', (err) => {
      reject(`Connection error: ${err.message}`);
    });

    conn.on('timeout', () => {
      reject('Connection timeout');
    });

    try {
      conn.connect(connectConfig);
    } catch (err) {
      reject(`Failed to connect: ${err.message}`);
    }
  });
});

ipcMain.on('ssh-write', (event, tabId, data) => {
  const session = activeSessions.get(tabId);
  if (session && session.stream) {
    if (typeof data === 'string') {
      session.stream.write(Buffer.from(data, 'utf-8'));
    } else {
      session.stream.write(data);
    }
  }
});

ipcMain.on('ssh-resize', (event, tabId, cols, rows) => {
  const session = activeSessions.get(tabId);
  if (session && session.stream && session.stream.setWindow) {
    try {
      session.stream.setWindow(rows, cols, 0, 0);
    } catch (e) { }
  }
});

ipcMain.on('ssh-disconnect', (event, tabId) => {
  const session = activeSessions.get(tabId);
  if (session && session.conn) {
    session.conn.end();
  }
  activeSessions.delete(tabId);
});
