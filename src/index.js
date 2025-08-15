const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const http = require("http");
const os = require("os")
const express = require("express")
const { Server } = require("socket.io")

const clientio = require('socket.io-client');


let win;
let io;
let socket;

let clients = {};
let chat = [];

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
    io = new Server(server,{maxHttpBufferSize: 1e9});


    event.sender.send("on-start-server", cipher(`${host}:${port}`))
    
    server.listen(port, host)


    console.log("starting server");


    io.on("connection", socket => {
        let name;
        socket.on("new-user-joined", (uname) => {
            console.log("New user:", socket.id, "name:", uname);
            clients[socket.id] = uname
            name = uname;
            socket.emit("prev-messages", chat)
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

        socket.on("disconnect", (reason) => {
            // delete clients[socket.id]
            console.log(`${name} left the chat`);
            
            socket.broadcast.emit("message", {id: socket.id, type: "info", message: `${name} left the chat`})


        })

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
        width: 800,
        height: 600,
        menu: null,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, "assets/logo.ico")

    })
    clinetWindow.loadFile(path.join(__dirname, "client.html"))
    
}

const createWindow = () => {
    win = new BrowserWindow({
        icon: "./assets/logo/png",
        width: 800,
        height: 600,
        menu: null,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    });
    // win.setAppliccationMenu(null)
    win.loadFile(path.join(__dirname, "index.html"))




}

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