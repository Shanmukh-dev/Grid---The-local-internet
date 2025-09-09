const { app, BrowserWindow, ipcMain, desktopCapturer, screen: electronScreen } = require("electron");
const path = require("path");
const http = require("http");
const os = require("os")
const express = require("express")
const { Server } = require("socket.io")
const { mouse, screen, Button } = require('@nut-tree-fork/nut-js');

const clientio = require('socket.io-client');


let win;
let io;
let socket;

let clients = {};
let chat = [];
let screenSharingUsers = new Set();
let screenCaptureIntervals = {};

function getLocalIP(){
    
    return os.hostname()
    
}
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cipher(input){
  let str = input;
  let length = str.length;
  let sqrt = Math.ceil(Math.sqrt(length));
  let cipher = ""
  let arr = [];
  let key = getRandomInt(1, 20)
  
  if(length < sqrt*sqrt){
    let diff = sqrt*sqrt - length;
    for(let i = 0; i<diff; i++){
      str += "#"
    }
  }
  
  for(let pos = 0; pos < str.length; pos++){
    arr.push(str[pos])
  }



  for(let r = 0; r < arr.length; r++){
    arr[r] = String.fromCharCode(arr[r].charCodeAt(0) ^ key);
  }
  cipher = arr.join("") + String.fromCharCode(key)
  return btoa(cipher).replace(/=/g, "")
}


function startServer(event) {
    let expressApp = express();
    let server = http.createServer(expressApp);
    const host = getLocalIP();
    const port = 9999
    io = new Server(server, {
        maxHttpBufferSize: 1e9,
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        allowEIO3: true
    });

    // Get screen dimensions
    let screenDimensions = {width: 1920, height: 1080}; // Default fallback
    (async () => {
        try {
            // Use Electron's screen module to get primary display size
            const primaryDisplay = electronScreen.getPrimaryDisplay();
            screenDimensions = primaryDisplay.size;
            io.emit("screen-dimensions", screenDimensions);
        } catch (error) {
            console.error("Failed to get screen dimensions:", error);
            io.emit("screen-dimensions", screenDimensions);
        }
    })();

    event.sender.send("on-start-server", cipher(`${host}:${port}`))
    
    server.listen(port, '0.0.0.0', () => {
        console.log(`Server listening on ${host}:${port}`);
    })


    console.log("starting server");


    io.on("connection", async socket => {
        let name;
        // Send screen dimensions to every new connection
        socket.emit("screen-dimensions", screenDimensions);

        socket.on("new-user-joined", (uname) => {
            console.log("New user:", socket.id, "name:", uname);
            clients[socket.id] = uname
            name = uname;
            socket.emit("prev-messages", chat)
            // Send current screen sharing users to new client
            socket.emit("screen-sharing-users", Array.from(screenSharingUsers))
            socket.broadcast.emit("message", {id: socket.id, type: "info", message: `${uname} joined the chat`})
        })
        socket.on("send", message => {
            let data;
            if(message.type === "file"){
                console.log(message);
                data = {id: socket.id, type: message.type, sender: clients[socket.id], content: message.content, fname: message.fname, mimeType: message.mimeType}
            }else{
                data = {id: socket.id, type: message.type, sender: clients[socket.id], message: message.message}
            }
            chat.push(data)

            socket.broadcast.emit("message", data)
        })

        socket.on("screen-frame", (data) => {
            // Broadcast screen frame to other clients
            socket.broadcast.emit("screen-frame", {
                userId: socket.id,
                frame: data.frame,
                timestamp: data.timestamp
            });
        });

        // Screen sharing events
        socket.on("start-screen-share", () => {
            console.log(`${clients[socket.id]} started screen sharing`);
            screenSharingUsers.add(socket.id);
            io.emit("user-started-sharing", {userId: socket.id, userName: clients[socket.id]});
            // Screen capture will be handled in the renderer process
        });

        socket.on("stop-screen-share", () => {
            console.log(`${clients[socket.id]} stopped screen sharing`);
            screenSharingUsers.delete(socket.id);
            io.emit("user-stopped-sharing", socket.id);
            
            // Stop screen capture
            if (screenCaptureIntervals[socket.id]) {
                clearInterval(screenCaptureIntervals[socket.id]);
                delete screenCaptureIntervals[socket.id];
            }
        });

        socket.on("disconnect", (reason) => {
            // Clean up screen sharing if user was sharing
            if (screenSharingUsers.has(socket.id)) {
                screenSharingUsers.delete(socket.id);
                io.emit("user-stopped-sharing", socket.id);

                if (screenCaptureIntervals[socket.id]) {
                    clearInterval(screenCaptureIntervals[socket.id]);
                    delete screenCaptureIntervals[socket.id];
                }
            }

            const userName = name || clients[socket.id] || 'Unknown user';
            console.log(`${userName} left the chat`);
            socket.broadcast.emit("message", {id: socket.id, type: "info", message: `${userName} left the chat`});

            // Clean up client data
            delete clients[socket.id];
        });

        socket.on("mouse-event", async (data) => {
            try {
                if (data.action === "move") {
                    await mouse.setPosition({x: Math.round(data.x), y: Math.round(data.y)});
                } else if (data.action === "down") {
                    await mouse.press(Button.LEFT);
                } else if (data.action === "up") {
                    await mouse.release(Button.LEFT);
                }
            } catch (error) {
                console.error("Mouse simulation error:", error);
            }
        });

    })

    setTimeout(() => {
        if (!io.connected) {
            console.log("server running");
        }
        else {
            console.log("server not reachable");
        }
    }, 1000)


}
function stopServer(event){
    if(io){
        io.close();
        console.log("Server stopped")
        event.sender.send("on-stop-server")
        chat.splice(0, chat.length)
    }
}

const openClient = () => {
    let clinetWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        menu: null,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
            webSecurity: false, // Allow screen capture
            allowRunningInsecureContent: true
        },
    })
    clinetWindow.loadFile(path.join(__dirname, "client.html"));
}
const createWindow = () => {
    win = new BrowserWindow({
        icon: "./assets/logo/png",
        width: 800,
        height: 600,
        menu: null,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    // win.setAppliccationMenu(null)
    win.loadFile(path.join(__dirname, "index.html"))




}

// Screen capture functionality
let currentScreenCapture = null;

ipcMain.handle('start-screen-capture', async () => {
    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        if (sources.length === 0) {
            throw new Error('No screen sources available');
        }
        
        const screenSource = sources[0];
        currentScreenCapture = {
            sourceId: screenSource.id,
            name: screenSource.name
        };
        
        return {
            success: true,
            sourceId: screenSource.id,
            name: screenSource.name
        };
    } catch (error) {
        console.error('Screen capture error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

ipcMain.handle('stop-screen-capture', () => {
    currentScreenCapture = null;
    return { success: true };
});



app.whenReady().then(() => {
    ipcMain.on("start-server", (event) => {
        startServer(event)
    })
    ipcMain.on("stop-server", (event) => {
        stopServer(event)
    })
    ipcMain.on("open-client", ()=>{
        openClient();
    })
    
    createWindow();
})
