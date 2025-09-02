// Socket.io is loaded from CDN script tag
const fileInp = document.getElementById("fileInp")
const chatInp = document.getElementById("chatInp")
const chat = document.getElementById("chatBox")
const hostInp = document.getElementById("hostInp");
const uname = document.getElementById("uname");
const joinBtn = document.getElementById("joinBtn");
const joinForm = document.getElementById("joinForm");
const selectedFiles = document.getElementById("selectedFiles"); 

const screenSharingSidebar = document.getElementById("screenSharingSidebar");
const screenSharingList = document.getElementById("screenSharingList");
const startScreenShareBtn = document.getElementById("startScreenShareBtn");
const stopScreenShareBtn = document.getElementById("stopScreenShareBtn");

let socket;
let recievedfiles = [];
let attachments = [];
let isScreenSharing = false;
let clients = {}; // Track connected clients

selectedFiles.style.height = "0px";

function append(msgObj) {
    let div = document.createElement("div");
    if (msgObj.type === "msg") {
        div.classList.add("msg", `msg-${msgObj.id === socket.id ? "right" : "left"}`);

        let sender = document.createElement("span");
        sender.classList.add("sender-name")
        let content = document.createElement("div");
        content.classList.add("msg-content")
        sender.innerText = msgObj.id === socket.id ? "You" : msgObj.sender;
        content.innerText = msgObj.message;
        div.append(sender);
        div.append(content);

    }
    else if (msgObj.type === "info") {
        div.classList.add("msg")
        div.classList.add("msg-center", "info");
        div.innerText = msgObj.message;
    }
    else if(msgObj.type === "file"){
        recievedfiles.push(msgObj)
        let imgUrl;
        if(msgObj.mimeType.includes("image")){
            let blob = new Blob([msgObj.content], {type: msgObj.mimeType});
            imgUrl = URL.createObjectURL(blob);
        }
        div.classList.add("msg", `msg-${msgObj.id === socket.id ? "right" : "left"}`);
        div.innerHTML = `
            <span class="sender-name">${msgObj.id === socket.id ? "You" : msgObj.sender}</span>
            <div class="msg-content">
                ${msgObj.mimeType.includes("image") ? 
                     `<img src=${imgUrl} alt="user Image" hegiht="300" width="400"> <br>` : ""
                } 
                <div style="display: flex; align-items: center; justify-content: spaced-between;">
                <span>${msgObj.fname}</span>
                <button class="btn btn-download" onclick="download(${recievedfiles.indexOf(msgObj)})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="currentColor" stroke-width="1.2" stroke="currentColor"><path d="M20 15.25a.75.75 0 0 1 .75.75v1A3.75 3.75 0 0 1 17 20.75H7A3.75 3.75 0 0 1 3.25 17v-.996a.75.75 0 1 1 1.5 0V17A2.25 2.25 0 0 0 7 19.25h10A2.25 2.25 0 0 0 19.25 17v-1a.75.75 0 0 1 .75-.75"/><path d="M12.75 4.5a.75.75 0 0 0-1.5 0v6.97H7.97a.75.75 0 0 0 0 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0 0-1.06h-3.28z"/></g></svg>
                </button>
                </div>

            </div>
        `
    }

    chat.append(div);
}

function decipher(string){
  string = atob(string)
  let length = string.length;
  let sqrt = Math.ceil(Math.sqrt(length));
  let arr = string.split("");
  let key = (arr.pop()).charCodeAt(0);
  

  for (let i = 0; i < arr.length; i++) {
    arr[i] = String.fromCharCode(arr[i].charCodeAt(0) ^ key);
    
  }
  return (arr.join("")).replace(/\#/g, "")
}

// Screen sharing event listeners - attached immediately
startScreenShareBtn.addEventListener("click", async () => {
    if (!socket) {
        alert("Please join the chat first");
        return;
    }
    try {
        // Use Electron IPC for screen capture
        const result = await window.electronAPI.startScreenCapture();
        if (!result.success) {
            throw new Error(result.error || 'Failed to start screen capture');
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: result.sourceId,
                    maxWidth: 1280,
                    maxHeight: 720,
                    maxFrameRate: 5
                }
            }
        });
        socket.emit("start-screen-share");
        isScreenSharing = true;
        startScreenShareBtn.style.display = "none";
        stopScreenShareBtn.style.display = "block";

        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        const captureInterval = setInterval(() => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL('image/jpeg', 0.7);
            socket.emit("screen-frame", {
                frame: frame,
                timestamp: Date.now()
            });
        }, 200); // 5 FPS

        // Store the interval to stop later
        window.screenCaptureInterval = captureInterval;
        window.screenStream = stream;
        
        // Handle when user stops sharing via browser controls
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            console.log('Screen sharing ended by user');
            if (socket) {
                socket.emit("stop-screen-share");
            }
            isScreenSharing = false;
            startScreenShareBtn.style.display = "block";
            stopScreenShareBtn.style.display = "none";
            
            if (window.screenCaptureInterval) {
                clearInterval(window.screenCaptureInterval);
                window.screenCaptureInterval = null;
            }
        });
    } catch (error) {
        console.error("Failed to start screen capture:", error);
        alert("Failed to start screen capture: " + error.message);
    }
});

stopScreenShareBtn.addEventListener("click", async () => {
    if (!socket) return;
    socket.emit("stop-screen-share");
    isScreenSharing = false;
    startScreenShareBtn.style.display = "block";
    stopScreenShareBtn.style.display = "none";

    // Stop screen capture via IPC
    await window.electronAPI.stopScreenCapture();
    
    // Stop screen capture
    if (window.screenCaptureInterval) {
        clearInterval(window.screenCaptureInterval);
        window.screenCaptureInterval = null;
    }
    if (window.screenStream) {
        window.screenStream.getTracks().forEach(track => track.stop());
        window.screenStream = null;
    }
});

joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (hostInp.value && uname.value) {
        try {
            const decodedHost = decipher(hostInp.value);
            console.log("Decoded host:", decodedHost);
            socket = io("http://" + decodedHost);
            socket.emit("new-user-joined", uname.value);

            socket.on("connect", () => {
                console.log("Socket connected:", socket.id);
                joinBtn.setAttribute("class", "btn-disabled");
                joinBtn.disabled = true;
                hostInp.disabled = true;
                hostInp.style = "opacity: 50%";
                uname.disabled = true;
                uname.style = "opacity: 50%";
            });

            socket.on("connect_error", (error) => {
                console.error("Socket connection error:", error);
                alert("Failed to connect to server: " + error.message);
            });

            socket.on("disconnect", (reason) => {
                console.log("Socket disconnected:", reason);
            });

            socket.on("message", (msg) => {
                console.log(msg);
                append(msg);
            });

            socket.on("prev-messages", (messages) => {
                for (const message of messages) {
                    append(message);
                }
            });

            // Socket event listeners for screen sharing
            socket.on("screen-sharing-users", (users) => {
                users.forEach(userId => {
                    // For initial screen sharing users, we might not have their names yet
                    addScreenSharingUser(userId, clients[userId] || 'Unknown User');
                });
            });

            socket.on("user-started-sharing", (data) => {
                addScreenSharingUser(data.userId, data.userName);
            });

            socket.on("user-stopped-sharing", (userId) => {
                removeScreenSharingUser(userId);
            });

            socket.on("screen-frame", (data) => {
                // This will be handled by the viewer window
                console.log("Received screen frame from:", data.userId);
            });
        } catch (error) {
            console.error("Error during join:", error);
            alert("Error joining chat: " + error.message);
        }
    }
})

let connected = false;

function download(fileIndex) {
    let currentFile = recievedfiles[fileIndex]
    let blob = new Blob([currentFile.content], { type: currentFile.type });
    let url = URL.createObjectURL(blob)

    let a = document.createElement("a")
    a.href = url
    a.download = currentFile.fname
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a);

    // Revoke the blob URL after the download
    URL.revokeObjectURL(url);
    console.log("Downloading file");

}

function deletefile(fileDiv, findex){
    fileDiv.remove()
    attachments.splice(findex, 1)
    if (attachments.length === 0){
        selectedFiles.style.height = "0px";
    }
}

function attachFile(fname, index){
    let fileDiv =  `<div class="file">
                <button onclick="deletefile(this.parentNode, ${index})">x</button>
                <span class="fname">${fname}</span>
            </div>`;
    selectedFiles.innerHTML += fileDiv;
    selectedFiles.style.height = "150px";
}

fileInp.addEventListener("change", () => {
    const files = fileInp.files;

    for(const file  of files){
        attachments.push(file);
        attachFile(file.name, attachments.indexOf(file));
    }
})

chatInp.addEventListener("submit", (e) => {
    e.preventDefault();
    let data = new FormData(e.target);
    // let files = fileInp.files;
    console.log(attachments);

    let msg = data.get("mesgInp");
    let message = { type: "msg", message: msg, id: socket.id };

    if (msg || attachments) {

        for (const file of attachments) {
            console.log(file);
            data = {
                type: "file",
                id: socket.id,
            };
            let reader = new FileReader();

            reader.onload = (e) => {
                data.content = e.target.result;
                data.fname = file.name;
                append({
                    type: "file",
                    id: socket.id,
                    content: e.target.result,
                    fname: file.name,
                    mimeType: file.type
                })

                socket.emit("send", {
                    type: "file",
                    id: socket.id,
                    content: new Uint8Array(e.target.result),
                    fname: file.name,
                    mimeType: file.type
                });
            }

            reader.onerror = (e) => {
                console.log(e.target.error);
            }
            
            
            
            reader.readAsArrayBuffer(file);
        }
        if(msg){

            append(message)
            socket.emit("send", message);
        }
        attachments.splice(0, attachments.length);
        selectedFiles.innerHTML = "";
        chatInp.reset()

    }
})

// Screen sharing functionality
function addScreenSharingUser(userId, userName) {
    const userElement = document.createElement("div");
    userElement.className = "screen-sharing-user";
    userElement.innerHTML = `
        <div class="user-info">
            <span class="user-name">${userName}</span>
            <span class="user-status">● Sharing</span>
        </div>
        <button class="btn-view" onclick="openScreenViewer('${userId}', '${userName}')">
            View Screen
        </button>
    `;
    userElement.dataset.userId = userId;
    screenSharingList.appendChild(userElement);
}

function removeScreenSharingUser(userId) {
    const userElement = document.querySelector(`[data-user-id="${userId}"]`);
    if (userElement) {
        userElement.remove();
    }
}

function openScreenViewer(userId, userName) {
    // Open a new window for screen viewing
    const viewerWindow = window.open('', `screenViewer_${userId}`,
        'width=1000,height=700,menubar=no,toolbar=no,location=no,status=no');

    // Get the server host from the current socket connection
    const serverHost = socket.io.engine.transport.ws.url.split('://')[1].split(':')[0];
    const socket = io("http://${serverHost}:9999");
    socket.on("connect", () => {
        console.log("Viewer socket connected:", socket.id);
        });
    socket.on("connect_error", (err) => {
                    console.error("Viewer socket connection error:", err);
                });
                socket.on("disconnect", (reason) => {
                    console.log("Viewer socket disconnected:", reason);
                });
                let isFullscreen = false;
                const canvas = document.getElementById("screenCanvas");
                const ctx = canvas.getContext("2d");
                let currentScale = 1;
                let offsetX = 0;
                let offsetY = 0;
                let imgWidth = 1280;
                let imgHeight = 720;
                
                function resizeCanvas() {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight - 100; // account for controls height
                    // Recalculate scale and offset if img is loaded
                    if (imgWidth && imgHeight) {
                        currentScale = Math.min(canvas.width / imgWidth, canvas.height / imgHeight);
                        offsetX = (canvas.width - imgWidth * currentScale) / 2;
                        offsetY = (canvas.height - imgHeight * currentScale) / 2;
                    }
                }
                window.addEventListener('resize', resizeCanvas);
                resizeCanvas();
                
                // Mouse event listener for tracking
                canvas.addEventListener('mousemove', (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    // Adjust for scale and offset to get position on original image
                    const imgX = (x - offsetX) / currentScale;
                    const imgY = (y - offsetY) / currentScale;
                    console.log('Mouse on image: x=${imgX}, y=${imgY}');
                    // You can send this to server if needed
                    // socket.emit("mouse-move", { userId: "${userId}", x: imgX, y: imgY });
                });
                
                socket.on("screen-frame", (data) => {
                    if (data.userId === "${userId}") {
                        console.log("Received frame for user:", data.userId);
                        if (!data.frame) {
                            console.warn("Empty frame data received");
                            return;
                        }
                        const img = new Image();
                        img.onload = () => {
                            imgWidth = img.width;
                            imgHeight = img.height;
                            currentScale = Math.min(canvas.width / img.width, canvas.height / img.height);
                            offsetX = (canvas.width - img.width * currentScale) / 2;
                            offsetY = (canvas.height - img.height * currentScale) / 2;
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, offsetX, offsetY, img.width * currentScale, img.height * currentScale);
                        };
                        img.onerror = (e) => {
                            console.error("Image load error:", e);
                        };
                        img.src = data.frame;
                    }
                });
                
                function toggleFullscreen() {
                    if (!isFullscreen) {
                        document.documentElement.requestFullscreen().catch(err => {
                            console.error('Fullscreen error:', err);
                        });
                    } else {
                        document.exitFullscreen();
                    }
                    isFullscreen = !isFullscreen;
                }
                
                window.addEventListener('beforeunload', () => {
                    socket.disconnect();
                });
            
}
