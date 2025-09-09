const { contextBridge, ipcRenderer, desktopCapturer } = require("electron");

contextBridge.exposeInMainWorld("socketServer", {
    startServer: () => { ipcRenderer.send('start-server') },
    stopServer: () => { ipcRenderer.send('stop-server') },
    onStartServer: (cb) => ipcRenderer.on("on-start-server", (_, host) => cb(host)),
    onStopServer: (cb) => ipcRenderer.on("on-stop-server", () => cb()),
    openClient: () => ipcRenderer.send("open-client")
});

contextBridge.exposeInMainWorld("socketClient", {
    connect: (url) => ipcRenderer.invoke("connect-socket", url),
    onConnect: (callback) => ipcRenderer.on("socket-connected", (_, id) => callback(id)),
    sendMessage: (message) => ipcRenderer.invoke("send-socket-message", message),
    onMessage: (callback) => ipcRenderer.on("socket-message", (_, msg) => callback(msg))
});

contextBridge.exposeInMainWorld("electronAPI", {
    getSources: async () => {
        return await desktopCapturer.getSources({ types: ['screen', 'window'] });
    },
    startScreenCapture: () => ipcRenderer.invoke('start-screen-capture'),
    stopScreenCapture: () => ipcRenderer.invoke('stop-screen-capture'),
    onScreenFrame: (callback) => ipcRenderer.on('screen-frame', (_, data) => callback(data)),

});
