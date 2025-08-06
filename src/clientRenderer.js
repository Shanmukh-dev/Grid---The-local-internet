const io = require("socket.io-client");
const fileInp = document.getElementById("fileInp")
const chatInp = document.getElementById("chatInp")
const chat = document.getElementById("chatBox")
const hostInp = document.getElementById("hostInp");
const uname = document.getElementById("uname");
const joinBtn = document.getElementById("joinBtn");

let socket;

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

    chat.append(div);
}
joinBtn.addEventListener("click", () => {
    if (hostInp.value && uname.value) {
        socket = io("http://" + hostInp.value)
        socket.emit("new-user-joined", uname.value)

        joinBtn.setAttribute("class", "btn-disabled")
        joinBtn.disabled = true;
        socket.on("message", (msg) => {
            console.log(msg);

            append(msg)

        })

        socket.on("prev-messages", (messages)=>{
            for(const message of messages){
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

function download() {
    let blob = new Blob(["Hello This is test!"], { type: "text/plain" });
    let url = URL.createObjectURL(blob)

    let a = document.createElement("a")
    a.href = url
    a.download = "Tst.txt"
    document.body.appendChild(a); // Required for Firefox
    a.click();
    document.body.removeChild(a);

    // Revoke the blob URL after the download
    URL.revokeObjectURL(url);
    console.log("Downloading file");

}



chatInp.addEventListener("submit", (e) => {
    e.preventDefault()
    let data = new FormData(e.target);
    let files = fileInp.files;
    console.log(files);

    let msg = data.get("mesgInp");
    let message = { type: "msg", message: msg, id: socket.id }

    if (msg) {

        append(message)
        socket.emit("send", message);
        chatInp.reset()

    }
})
