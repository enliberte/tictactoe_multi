const sock = io();


function borderCell(event) {
    if (event.target.classList.contains('cell')) {
        if (event.type === 'mouseover') {
            event.target.style.border = '3px green solid';
        } else if (event.type === 'mouseout') {
            event.target.style.border = '1px white solid';
        }
    }
}


function sendCell(event) {
    if (event.target.classList.contains('cell')) {
        sock.emit('pressedCell',
            {
                id: event.target.id,
                row: event.target.getAttribute('row'),
                cln: event.target.getAttribute('cln')
            });
    }
}


function startNewGame(event) {
    document.querySelector('#field').addEventListener('click', sendCell);
    sock.emit('newGame');
}


class GameField {
    constructor(size) {
        this.size = size;
        this.field = document.querySelector('#field');
        sock.on('gameState', (state) => {
            console.log(state);
            this.refresh(state.cells);
        });
        sock.on('winner', (winner) => {
            this.field.removeEventListener('click', sendCell);
            this.showResult(winner);
        });
        sock.on('hideResult', () => {
            let gameResult = document.querySelector('#result');
            if (gameResult) {
                document.body.removeChild(gameResult);
            }
        })
    }

    showResult(result) {
        let gameResult = document.createElement('div');
        gameResult.textContent = result;
        gameResult.id = 'result';
        gameResult.style.left = `${this.field.clientHeight / 2 - gameResult.clientWidth / 2}px`;
        gameResult.style.top = `-${this.field.clientHeight / 2 + gameResult.clientHeight / 2}px`;
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
        this.field.addEventListener('click', sendCell);
        this.field.addEventListener('mouseover', borderCell);
        this.field.addEventListener('mouseout', borderCell);
        for (let rowNum = 0; rowNum < this.size; rowNum++) {
            let row = document.createElement('div');
            row.classList.add('line');
            this.field.appendChild(row);
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
    }
}

new GameField(20).draw();
document.querySelector('#refresh').addEventListener('click', startNewGame);
