const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require("electron");
const path = require("path"), http = require("http"), os = require("os"), express = require("express"), { Server } = require("socket.io");
const { mouse, keyboard, straightTo, Point, Button, Key } = require("@nut-tree-fork/nut-js");

let win, io, clients = {}, chat = [], screenSharingUsers = new Set(), screenCaptureIntervals = {}, hostSocketId = null, screenSize = null;

function getLocalIP() { return os.hostname(); }
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function cipher(input) {
  let str = input, len = str.length, sqrt = Math.ceil(Math.sqrt(len)), arr = [], key = getRandomInt(1, 20);
  if (len < sqrt * sqrt) str += "#".repeat(sqrt * sqrt - len);
  for (let i = 0; i < str.length; i++) arr.push(str[i]);
  for (let i = 0; i < arr.length; i++) arr[i] = String.fromCharCode(arr[i].charCodeAt(0) ^ key);
  return btoa(arr.join("") + String.fromCharCode(key)).replace(/=/g, "");
}

function startServer(event) {
  let server = http.createServer(express()), host = getLocalIP(), port = 9999;
  io = new Server(server, { maxHttpBufferSize: 1e9, cors: { origin: "*", methods: ["GET", "POST"] }, allowEIO3: true });
  screenSize = screen.getPrimaryDisplay().size; // Store screen size for denormalization
  event.sender.send("on-start-server", cipher(`${host}:${port}`));
  server.listen(port, '0.0.0.0', () => console.log(`Server listening on ${host}:${port}`));
  io.on("connection", socket => {
    socket.on("new-user-joined", uname => {
      clients[socket.id] = uname;
      socket.emit("prev-messages", chat);
      socket.emit("screen-sharing-users", Array.from(screenSharingUsers));
      io.emit("screen-dimensions", screenSize); // Emit screen dimensions on new user join
      socket.broadcast.emit("message", { id: socket.id, type: "info", message: `${uname} joined the chat` });
    });
    socket.on("identify-as-host", () => {
      hostSocketId = socket.id;
      console.log(`Host identified: ${socket.id}`);
    });
    socket.on("send", message => {
      let data = message.type === "file" ? { id: socket.id, type: message.type, sender: clients[socket.id], content: message.content, fname: message.fname, mimeType: message.mimeType } : { id: socket.id, type: message.type, sender: clients[socket.id], message: message.message };
      chat.push(data);
      socket.broadcast.emit("message", data);
    });
    socket.on("screen-frame", data => socket.broadcast.emit("screen-frame", { userId: socket.id, frame: data.frame, timestamp: data.timestamp }));
    socket.on("start-screen-share", () => {
      screenSharingUsers.add(socket.id);
      io.emit("user-started-sharing", { userId: socket.id, userName: clients[socket.id] });
    });
    socket.on("stop-screen-share", () => {
      screenSharingUsers.delete(socket.id);
      io.emit("user-stopped-sharing", socket.id);
      if (screenCaptureIntervals[socket.id]) clearInterval(screenCaptureIntervals[socket.id]), delete screenCaptureIntervals[socket.id];
    });
    socket.on("disconnect", () => {
      if (screenSharingUsers.has(socket.id)) screenSharingUsers.delete(socket.id), io.emit("user-stopped-sharing", socket.id), screenCaptureIntervals[socket.id] && clearInterval(screenCaptureIntervals[socket.id]), delete screenCaptureIntervals[socket.id];
      socket.broadcast.emit("message", { id: socket.id, type: "info", message: `${clients[socket.id] || 'Unknown user'} left the chat` });
      delete clients[socket.id];
    });

    // Remote mouse control event listener
    socket.on("mouse-event", async (data) => {
      if (socket.id !== hostSocketId) return; // Only allow host to execute
      if (data.type !== "mouse") return;
      try {
        const denormalizedX = Math.round(data.x * screenSize.width);
        const denormalizedY = Math.round(data.y * screenSize.height);
        if (data.action === "move") {
          await mouse.move(straightTo(new Point(denormalizedX, denormalizedY)));
        } else if (data.action === "down") {
          const button = data.button === 0 ? Button.LEFT : data.button === 1 ? Button.MIDDLE : Button.RIGHT;
          await mouse.pressButton(button);
        } else if (data.action === "up") {
          const button = data.button === 0 ? Button.LEFT : data.button === 1 ? Button.MIDDLE : Button.RIGHT;
          await mouse.releaseButton(button);
        }
      } catch (error) {
        console.error("Error handling mouse event:", error);
      }
    });
  });
}

function stopServer(event) {
  if (io) io.close(), event.sender.send("on-stop-server"), chat.length = 0;
}

const openClient = () => {
  let clientWindow = new BrowserWindow({
    width: 800, height: 600, menu: null, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, enableRemoteModule: false, webSecurity: false, allowRunningInsecureContent: true }
  });
  clientWindow.loadFile(path.join(__dirname, "client.html"));
};

const createWindow = () => {
  win = new BrowserWindow({
    icon: "./assets/logo.png", width: 800, height: 600, menu: null, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, "index.html"));
};

let currentScreenCapture = null;
ipcMain.handle('start-screen-capture', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    if (!sources.length) throw new Error('No screen sources available');
    const screenSource = sources[0];
    currentScreenCapture = { sourceId: screenSource.id, name: screenSource.name };
    return { success: true, sourceId: screenSource.id, name: screenSource.name };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle('stop-screen-capture', () => (currentScreenCapture = null, { success: true }));

app.whenReady().then(() => {
  ipcMain.on("start-server", startServer);
  ipcMain.on("stop-server", stopServer);
  ipcMain.on("open-client", openClient);
  createWindow();
});
