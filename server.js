const http = require('http');
const express = require('express');
const socketio = require('socket.io');


class Game {
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
            io.emit('winner', 'Ничья');
            return;
        }

        //выигрыш
        for (let offset = -this.toWin + 1; offset < this.toWin; offset++) {
            sumInRow = this.calcSum(this.field[`r${cell.row}c${+cell.cln + offset}`], sumInRow); //ряд
            sumInCln = this.calcSum(this.field[`r${+cell.row + offset}c${cell.cln}`], sumInCln); //колонка
            sumInRL = this.calcSum(this.field[`r${+cell.row + offset}c${+cell.cln + offset}`], sumInRL); //диагональ справа-налево
            sumInLR = this.calcSum(this.field[`r${+cell.row - offset}c${+cell.cln + offset}`], sumInLR); //диагональ слева-направо
            if (sumInRow === this.toWin || sumInCln === this.toWin || sumInRL === this.toWin || sumInLR === this.toWin) {
                io.emit('winner', `Выиграли: ${this.getFigure()}`);
                return;
            }
        }
    }

    initField(){
        this.currentFigure = true;
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

let game = new Game(20);
game.initField();

const port = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const io = socketio(server);


//отдача статики
app.use(express.static(`${__dirname}/client`));


io.on('connection', (sock) => {
    sock.emit('gameState', {cells: game.field});
    sock.on('pressedCell', (cell) => {
        if (game.setState(cell)) {
            game.checkWinner(cell);
            game.currentFigure = !game.currentFigure;
        }
        io.emit('gameState', {cells: game.field});
    });
    sock.on('newGame', () => {
        io.emit('hideResult');
        game.initField();
        io.emit('gameState', {cells: game.field});
    });
});



server.on('error', (err) => {console.log(`Server error: ${err}`)});
server.listen(port, () => {console.log(`App is running on port ${port}`);});


