const { read } = require("original-fs");
const io = require("socket.io-client");
const fileInp = document.getElementById("fileInp")
const chatInp = document.getElementById("chatInp")
const chat = document.getElementById("chatBox")
const hostInp = document.getElementById("hostInp");
const uname = document.getElementById("uname");
const joinBtn = document.getElementById("joinBtn");
const joinForm = document.getElementById("joinForm");
const selectedFiles = document.getElementById("selectedFiles"); 

let socket;
let recievedfiles = [];
let attachments = [];

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

joinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (hostInp.value && uname.value) {
        socket = io("ws://" + decipher(hostInp.value))
        socket.emit("new-user-joined", uname.value)

        joinBtn.setAttribute("class", "btn-disabled")
        joinBtn.disabled = true;
        socket.on("message", (msg) => {
            console.log(msg);

            append(msg)

        })

        socket.on("prev-messages", (messages) => {
            for (const message of messages) {
                append(message);
            }
        })

        hostInp.disabled = true
        hostInp.style = "opacity: 50%"
        uname.disabled = true
        uname.style = "opacity: 50%"
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
