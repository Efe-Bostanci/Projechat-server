const http = require('http');
const server = http.createServer((req, res) => {});

server.listen(3000, () => {
    console.log("Port 3000 üzerinde dinleniyor...");
});

const io = require('socket.io')(server);
const connections = [];

io.on('connection', (socket) => {
    console.log('Yeni bağlantı');
    connections.push(socket);

    socket.on('message', (message) => {
        connections.forEach(element => {
            if (element !== socket)
                element.emit('message', message);
        });
    });

    socket.on('disconnect', () => {
        console.log('Bağlantı kapatıldı');
        connections.splice(connections.indexOf(socket), 1);
    });
});
