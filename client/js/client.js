class Control {
    constructor() {
        this.elm = null;
    }

    on(event, callback) {
        this.elm.addEventListener(event, callback);
    }

    clear() {
        this.elm.innerHTML = '';
    }

    hide() {
        this.elm.hidden = true;
    }

    show() {
        this.elm.hidden = false;
    }
}


class Block extends Control{
    constructor(args) {
        super();
        this.elm = document.createElement('div');
        for (let arg in args) {
            this.elm[arg] = args[arg];
        }
    }
}


class Menu extends Control{
    constructor(id, controls) {
        super();
        this.elm = document.createElement('div');
        this.elm.id = id;
        this.controls = controls;
        this.append(controls);
    }

    append(controls) {
        for (let control in controls) {
            this.elm.appendChild(controls[control].elm);
        }
    }
}


class Rooms extends Menu {
    constructor(id, controls, clientSocket) {
        super(id, controls);
        this.clientSocket = clientSocket;
    }

    display(rooms) {
        this.clear();
        let roomsObj = {};
        for (let room of rooms) {
            roomsObj[room] = new Block({'id': room, 'className': 'room', 'textContent': `КОМНАТА (id: ${room})`});
            roomsObj[room].on('click', () => {
                this.hide();
                this.clientSocket.emit('joinRoom', room);
            });
        }
        this.controls = roomsObj;
        this.append(roomsObj);

        let backToMenuBtn = new Block({'id': 'back-to-menu-btn', 'textContent': 'НАЗАД В МЕНЮ'});
        backToMenuBtn.elm.addEventListener('click', () => {this.clientSocket.emit('exitRooms');});
        this.elm.appendChild(backToMenuBtn.elm);
    }
}


class GameField extends Control{
    constructor(size, clientSocket) {
        super();

        this.clientSocket = clientSocket;
        this.size = size;

        this.elm = document.createElement('div');
        this.elm.id = 'field';
        this.draw();

        this.restartGameBtn = new Block({'id': 'refresh', 'textContent': 'НАЧАТЬ ИГРУ ЗАНОВО'});
        this.elm.appendChild(this.restartGameBtn.elm);

        this.backToBtn = new Block({'id': 'back-to-menu-btn', 'textContent': 'НАЗАД В МЕНЮ'});
        this.elm.appendChild(this.backToBtn.elm);

        this.elm.addEventListener('click', (event) => {this.sendCell(event)});
        this.elm.addEventListener('mouseover', (event) => {this.borderCell(event)});
        this.elm.addEventListener('mouseout', (event) => {this.borderCell(event)});

        this.restartGameBtn.on('click', (event) => {this.startNewGame(event)});
        this.backToBtn.on('click', (event) => {this.clientSocket.emit('exitGamefield');});

        this.clientSocket.on('gameState', (state) => {console.log(state); this.refresh(state.cells)});
        this.clientSocket.on('winner', (winner) => {this.showResult(winner);});
        this.clientSocket.on('hideResult', () => {
            let gameResult = document.querySelector('#result');
            if (gameResult) {
                document.body.removeChild(gameResult);
            }
        })
    }

    borderCell(event) {
        if (event.target.classList.contains('cell')) {
            if (event.type === 'mouseover') {
                event.target.style.border = '3px green solid';
            } else if (event.type === 'mouseout') {
                event.target.style.border = '1px white solid';
            }
        }
    }

    startNewGame(event) {
        this.clientSocket.emit('newGame');
    }

    sendCell(event) {
        if (event.target.classList.contains('cell')) {
            this.clientSocket.emit('pressedCell',
                {
                    id: event.target.id,
                    row: event.target.getAttribute('row'),
                    cln: event.target.getAttribute('cln')
                });
        }
    }

    showResult(result) {
        let gameResult = document.createElement('div');
        gameResult.textContent = result;
        gameResult.id = 'result';
        gameResult.style.left = `${this.elm.clientHeight / 2 - gameResult.clientWidth / 2}px`;
        gameResult.style.top = `-${this.elm.clientHeight / 2 + gameResult.clientHeight / 2}px`;
        document.body.appendChild(gameResult);
    }

    refresh(cells) {
        for (let cell in cells) {
            if (cells[cell]) {
                document.querySelector(`#${cell}`).textContent = cells[cell];
            } else {
                document.querySelector(`#${cell}`).textContent = '';
            }
        }
    }

    draw() {
        for (let rowNum = 0; rowNum < this.size; rowNum++) {
            let row = document.createElement('div');
            row.classList.add('line');
            this.elm.appendChild(row);
            for (let cellNum = 0; cellNum < this.size; cellNum++) {
                let cell = document.createElement('div');
                cell.classList.add('cell');
                cell.id = `r${rowNum}c${cellNum}`;
                cell.setAttribute('row', `${rowNum}`);
                cell.setAttribute('cln', `${cellNum}`);
                let cellSize = document.documentElement.clientHeight / this.size;
                cell.style.height = `${cellSize}px`;
                cell.style.width = `${cellSize}px`;
                cell.style.lineHeight = `${cellSize}px`;
                cell.style.fontSize = `${cellSize * 0.8}px`;
                row.appendChild(cell);
            }
        }
        document.body.appendChild(this.elm);
    }
}


class Game {
    constructor() {
        this.clientSocket = io();

        // рисуем интерфейс
        this.menu = new Menu('menu',
            {
                createRoomBtn: new Block({'id': 'create-room-btn', 'textContent': 'НАЧАТЬ ИГРУ'}),
                joinRoomBtn: new Block({'id': 'join-room-btn', 'textContent': 'ПРИСОЕДИНИТЬСЯ К ИГРЕ'})
            }
        );
        this.rooms = new Rooms('rooms', {}, this.clientSocket);
        this.gamefield = null;

        document.body.appendChild(this.menu.elm);
        document.body.appendChild(this.rooms.elm);

        //обрабатываем события
        this.clientSocket.on('displayMenu', () => this.menu.show());
        this.clientSocket.on('hideMenu', () => this.menu.hide());
        this.clientSocket.on('roomList', (rooms) => {this.rooms.display(rooms);});
        this.clientSocket.on('hideRoomList', () => {
            this.rooms.clear();
            this.menu.show();
        });
        this.clientSocket.on('drawGamefield', (size) => {this.gamefield = new GameField(size, this.clientSocket)});
        this.clientSocket.on('hideGamefield', () => {
            document.body.removeChild(this.gamefield.elm);
            this.gamefield = null;
        });

        //обработчики на кнопках
        this.menu.controls.createRoomBtn.on('click', (event) => {this.clientSocket.emit('createRoom');});
        this.menu.controls.joinRoomBtn.on('click', (event) => {this.clientSocket.emit('selectRoom');});

    }
}


const game = new Game();
