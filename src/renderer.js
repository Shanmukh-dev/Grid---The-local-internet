const startBtn = document.getElementById("start-btn")
const stopBtn = document.getElementById("stop-btn")
const openClient = document.getElementById("open-client")
const serverStat = document.getElementById("serverStat")

let isClientOpen = false;



socketServer.onStartServer((host)=>{
    serverStat.innerText = `Server running on host: ${host}`
    stopBtn.setAttribute("class", "btn-primary")
    startBtn.setAttribute("class", "btn-disabled")
    stopBtn.disabled = false;
    startBtn.disabled = true
})

socketServer.onStopServer(()=>{
    serverStat.innerText = `Server has not started`
    stopBtn.setAttribute("class", "btn-disabled")
    startBtn.setAttribute("class", "btn-primary")
    stopBtn.disabled = true;
    startBtn.disabled = false
})

startBtn.addEventListener("click", () => {
  socketServer.startServer();
})
stopBtn.addEventListener("click", () => {
  socketServer.stopServer();
})

openClient.addEventListener("click", ()=>{
  socketServer.openClient()
})


