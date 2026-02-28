const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Store operations
    getData: (key) => ipcRenderer.invoke('get-data', key),
    setData: (key, value) => ipcRenderer.invoke('set-data', key, value),

    // File dialog
    selectKeyFile: () => ipcRenderer.invoke('select-key-file'),

    // SSH operations
    connectSsh: (config, tabId) => ipcRenderer.invoke('ssh-connect', config, tabId),
    writeSsh: (tabId, data) => ipcRenderer.send('ssh-write', tabId, data),
    resizeSsh: (tabId, cols, rows) => ipcRenderer.send('ssh-resize', tabId, cols, rows),
    disconnectSsh: (tabId) => ipcRenderer.send('ssh-disconnect', tabId),

    // SSH Events (Event Listeners)
    onSshData: (tabId, callback) => {
        const channel = `ssh-data-${tabId}`;
        const listener = (event, data) => callback(data);
        ipcRenderer.on(channel, listener);
        // return unsubscribe function
        return () => ipcRenderer.removeListener(channel, listener);
    },
    onSshClosed: (tabId, callback) => {
        const channel = `ssh-closed-${tabId}`;
        const listener = () => callback();
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    }
});
