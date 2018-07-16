let express = require('express');
let app = express();
let server = require('http').createServer(app);
let io = require('socket.io').listen(server);
let fs = require('fs');

app.use('/', express.static('.'));

server.listen (9000, () => {
    console.log ('Listen on port 9000');
});

let DB = [];

io.on ('connect', (socket) => {
    console.log ('Nový klient pripojený.');

    socket.on ('disconnect', msg => {
        console.log ('Klient odpojený.', msg);
    });
    socket.on ('error', error => {
        console.log ('Chyba spojenia.', error.message);
    });


    socket.on ('data', obj => {
        DB.push(obj);
        io.emit ('refreshScores', DB);
    });

    socket.on ('getScores', ackFunc => {
        ackFunc(DB);
    });
});



