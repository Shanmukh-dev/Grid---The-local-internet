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
    let nets = os.networkInterfaces();
    for(key of Object.keys(nets)){
        let interface = nets[key];
        for(i of interface){

            if(i.family === "IPv4" && i.address !== "127.0.0.1"){
                console.log(i.address);
                
                return i.address
    
            }
        }
    }
    
}


function startServer(event) {
    let expressApp = express();
    let server = http.createServer(expressApp);
    const host = getLocalIP();
    const port = 9999
    io = new Server(server);

    event.sender.send("on-start-server", host, port)

    server.listen(port, host)


    console.log("starting server");


    io.on("connection", socket => {
        console.log(socket.id);
        let name;
        socket.on("new-user-joined", (uname) => {
            clients[socket.id] = uname
            name = uname;
            socket.emit("prev-messages", chat)
            socket.broadcast.emit("message", {id: socket.id, type: "info", message: `${uname} joined the chat`})
        })
        socket.on("send", message => {
            console.log(message);
            let data = {id: socket.id, type: message.type, sender: clients[socket.id], message: message.message}
            chat.push(data)

            socket.broadcast.emit("message", data)
        })

        socket.on("disconnect", (reason) => {
            delete clients[socket.id]
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
    }
    chat.splice(0, chat.lengths)
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