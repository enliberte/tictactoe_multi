const http = require('http');
const express = require('express');
const socketio = require('socket.io');


class Gamefield {
    constructor(size) {
        this.size = size;
        this.toWin = 5;
    }

    getFigure() {
        return (this.currentFigure) ? 'X' : 'O';
    }

    setState(cell) {
        if (!this.field[cell.id]) {
            this.field[cell.id] = this.getFigure();
            return true;
        }
        return false;
    }

    calcSum(cell, currentSum) {
        let sum = currentSum;
        if (cell) {
            if (cell === this.getFigure()) {
                sum++;
            } else {
                sum = 0;
            }
        }
        return sum;
    }

    checkWinner(cell) {
        let sumInRow = 0;
        let sumInCln = 0;
        let sumInLR = 0;
        let sumInRL = 0;

        //ничья
        if (Object.values(this.field).every((cellState) => {return !!cellState})) {
            this.winner = 'Ничья';
            return true;
        }

        //выигрыш
        for (let offset = -this.toWin + 1; offset < this.toWin; offset++) {
            sumInRow = this.calcSum(this.field[`r${cell.row}c${+cell.cln + offset}`], sumInRow); //ряд
            sumInCln = this.calcSum(this.field[`r${+cell.row + offset}c${cell.cln}`], sumInCln); //колонка
            sumInRL = this.calcSum(this.field[`r${+cell.row + offset}c${+cell.cln + offset}`], sumInRL); //диагональ справа-налево
            sumInLR = this.calcSum(this.field[`r${+cell.row - offset}c${+cell.cln + offset}`], sumInLR); //диагональ слева-направо
            if (sumInRow === this.toWin || sumInCln === this.toWin || sumInRL === this.toWin || sumInLR === this.toWin) {
                this.winner = `Выиграли: ${this.getFigure()}`;
                return true;
            }
        }

        return false;
    }

    initField(){
        this.currentFigure = true;
        this.winner = null;
        this.field = this.createFieldObj();
    }

    createFieldObj() {
        let fieldObj = {};
        for (let rowNum = 0; rowNum < this.size; rowNum++) {
            for (let clnNum = 0; clnNum < this.size; clnNum++) {
                fieldObj[`r${rowNum}c${clnNum}`] = null;
            }
        }
        return fieldObj;
    }
}


class Room {
    constructor(id, clientSocket) {
        this.id = id;
        this.clientSockets = [];
        this.clientSockets.push(clientSocket);
        this.gamefield = new Gamefield(20);
        this.gamefield.initField();

        //обработка событий
        this.sendInitGameField(clientSocket);
        this.subscribeOnGameStateChange(clientSocket);
    }

    join(clientSocket) {
        this.clientSockets.push(clientSocket);
        this.sendInitGameField(clientSocket);
        this.subscribeOnGameStateChange(clientSocket);
    }

    exit(clientSocket) {
        this.clientSockets = this.clientSockets.filter((oneClientSocket) => {return oneClientSocket !== clientSocket});
    }

    sendInitGameField(clientSocket) {
        clientSocket.emit('drawGamefield', this.gamefield.size);
        clientSocket.emit('gameState', {cells: this.gamefield.field});
        if (this.gamefield.winner) {
            clientSocket.emit('winner', this.gamefield.winner)
        }
    }

    emitToAll(event, args) {
        for (let oneClientSocket of this.clientSockets) {
            oneClientSocket.emit(event, args);
        }
    }

    subscribeOnGameStateChange(clientSocket) {
        clientSocket.on('pressedCell', (cell) => {
            if (this.gamefield.setState(cell)) {
                if (this.gamefield.checkWinner(cell)) {
                    this.emitToAll('winner', this.gamefield.winner);
                }
                this.gamefield.currentFigure = !this.gamefield.currentFigure;
            }
            this.emitToAll('gameState', {cells: this.gamefield.field});
        });

        clientSocket.on('newGame', () => {
            this.gamefield.initField();
            this.emitToAll('hideResult');
            this.emitToAll('gameState', {cells: this.gamefield.field});
        });
    }
}


class Game {
    constructor() {
        this.port = process.env.PORT || 8000;
        this.app = express();
        this.server = http.createServer(this.app);
        this.serverSocket = socketio(this.server);
        this.rooms = {};

        //отдача статики
        this.app.use(express.static(`${__dirname}/client`));

        //биндим на порт
        this.server.on('error', (err) => {console.log(`Server error: ${err}`)});
        this.server.listen(this.port, () => {console.log(`App is running on port ${this.port}`);});

        //обработка событий
        this.serverSocket.on('connection', (clientSocket) => {
            clientSocket.emit('displayMenu');
            clientSocket.on('createRoom', () => {
                clientSocket.emit('hideMenu');
                this.createRoom(clientSocket);
            });
            clientSocket.on('selectRoom', () => {
                clientSocket.emit('hideMenu');
                clientSocket.emit('roomList', this.getFreeRooms());
            });
            clientSocket.on('joinRoom', (id) => {this.rooms[id].join(clientSocket);});
            clientSocket.on('exitRooms', () => {
                clientSocket.emit('hideRoomList');
                clientSocket.emit('displayMenu');
            });
            clientSocket.on('exitRooms', () => {
                clientSocket.emit('hideRoomList');
                clientSocket.emit('displayMenu');
            });
            clientSocket.on('exitGamefield', () => {
                clientSocket.emit('hideGamefield');
                clientSocket.emit('displayMenu');
                for (let id in this.rooms) {
                    if (this.rooms[id].clientSockets.indexOf(clientSocket) !== -1) {
                        this.rooms[id].exit(clientSocket);
                        if (this.rooms[id].clientSockets.length === 0) {
                            this.removeRoom(id);
                        }
                        break;
                    }
                }
            });
        })
    }

    createRoom(clientSocket) {
        let id = Math.random(); //переписать под uuid v4
        this.rooms[id] = new Room(id, clientSocket);
    }

    removeRoom(id) {
        delete this.rooms[id];
    }

    getFreeRooms() {
        let freeRooms = [];
        for (let room in this.rooms) {
            if (this.rooms[room].clientSockets.length < 2) {
                freeRooms.push(room);
            }
        }
        return freeRooms;
    }
}


new Game();






