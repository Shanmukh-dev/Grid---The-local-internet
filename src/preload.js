const { contextBridge, ipcRenderer, desktopCapturer } = require("electron");

contextBridge.exposeInMainWorld("socketServer", {
  startServer: () => ipcRenderer.send('start-server'),
  stopServer: () => ipcRenderer.send('stop-server'),
  onStartServer: cb => ipcRenderer.on("on-start-server", (_, host) => cb(host)),
  onStopServer: cb => ipcRenderer.on("on-stop-server", () => cb()),
  openClient: () => ipcRenderer.send("open-client")
});

contextBridge.exposeInMainWorld("socketClient", {
  connect: url => ipcRenderer.invoke("connect-socket", url),
  onConnect: cb => ipcRenderer.on("socket-connected", (_, id) => cb(id)),
  sendMessage: msg => ipcRenderer.invoke("send-socket-message", msg),
  onMessage: cb => ipcRenderer.on("socket-message", (_, msg) => cb(msg))
});

contextBridge.exposeInMainWorld("electronAPI", {
  getSources: async () => await desktopCapturer.getSources({ types: ['screen', 'window'] }),
  startScreenCapture: () => ipcRenderer.invoke('start-screen-capture'),
  stopScreenCapture: () => ipcRenderer.invoke('stop-screen-capture'),
  onScreenFrame: cb => ipcRenderer.on('screen-frame', (_, data) => cb(data))
});
