const http = require('http');
const server = http.createServer((req, res) => {});

server.listen(3000, () => {
    console.log("Port 3000 üzerinde dinleniyor...");
});

const io = require('socket.io')(server);

// Odaları saklamak için bir nesne oluştur
const rooms = {};

io.on('connection', (socket) => {
    console.log('Yeni bağlantı');

    socket.on('joinRoom', (room) => {
        // Kullanıcıyı belirtilen odaya katılmasını sağla
        socket.join(room);

        // Odaya katılan kullanıcılara bildirim gönder
        io.to(room).emit('message', 'Kullanıcı katıldı: ' + socket.id);
    });

    socket.on('message', (data) => {
        // İlgili odaya mesajı gönder
        io.to(data.room).emit('message', data.message);
    });

    socket.on('disconnect', () => {
        console.log('Bağlantı kapatıldı');

        // Kullanıcının ayrıldığı odaları bul
        const roomsLeft = Object.keys(socket.rooms);

        // Her odadan kullanıcıyı çıkar
        roomsLeft.forEach(room => {
            socket.leave(room);
            io.to(room).emit('message', 'Kullanıcı ayrıldı: ' + socket.id);
        });
    });
});
