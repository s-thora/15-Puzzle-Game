let socket = io.connect();

Puzzles = [];

socket.on ('refreshScores', DB => {
    for (let i=0; i < Puzzles.length; i++) {
        Puzzles[i].refreshScores(DB);
    }
});


class Puzzle15 {

    constructor(rootElement, cfg) {
        /* Hra sa vytvorí podľa konfigurácie v (JSON) objekte cfg.*/
        this.rootElement = rootElement;
        this.setState(cfg);
        this.buildTitle();
        this.buildStatusBar();
        this.buildPlayground();
        this.buildInfoPane();
        this.buildScorePane();

        window.addEventListener('resize', this.resize, false);
        window.addEventListener('keydown', this.keyPress.bind(this), false);

        socket.emit('getScores', this.refreshScores.bind(this));
        Puzzles.push(this);
    }

    resize() {
        /* Zavolá sa, ak sa zmení veľkosť rootElementu. */
        let header = document.getElementsByClassName('title')[0];
        updElem(header, null, getHeaderSizes().height, getHeaderSizes().fontSize, null, null);

        let status = document.getElementsByClassName('status')[0];
        updElem(status, null, getStatusSizes().height, getStatusSizes().fontSize, null, getHeaderSizes().height);

        let cells = document.getElementsByClassName('cell');
        Array.prototype.forEach.call(cells, function(cell) {
            updElem(cell, getCellSizes().cellSize, getCellSizes().cellSize, getCellSizes().fontSize);
        });
    }

    /* Nastaví situáciu hry podľa (JSON) objektu. */
    setState(gameState) {
        this.initGameState = JSON.parse(gameState);
        let positions = this.initGameState.state[0].positions.split('-');
        let arrPoss = [];
        Array.prototype.forEach.call(positions, function (position) {
            arrPoss.push(parseInt(position));});
        let arrTime = this.initGameState.state[0].time.split(':');

        this.name = this.initGameState.state[0].name;
        this.timestamp = this.initGameState.state[0].timestamp;
        this.poss = arrPoss;
        this.time = {
            h: parseInt(arrTime[0]),
            m: parseInt(arrTime[1]),
            s: parseInt(arrTime[2])};
        this.moves = this.initGameState.state[0].moves;
        this.score = this.initGameState.state[0].score;
        this.finished = parseBoolean(this.initGameState.state[0].finished);
        this.interval = null;
        this.run = false; // actually playing
        this.begun = false; // started
        this.controlByKeys = false;
    }

    /* Vráti situáciu hry ako (JSON) objekt. */
    getState() {
        return '{   "state" : [{\n' +
                    '"name": "' + this.name + '",\n' +
                    '"timestamp": "' + this.timestamp + '",\n' +
                    '"positions": "' + this.poss.join('-') + '",\n' +
                    '"time": "' + this.time.h + ":" + this.time.m + ":" + this.time.s + '",\n' +
                    '"moves": "' + this.moves + '",\n' +
                    '"score": "' + this.score + '",\n' +
                    '"finished": "' + this.finished + '" } ]}';
    }

    /* Ovladanie behu hry. */
    start() {
        removeAllChildren(this.rootElement);
        this.setState(generateState());
        this.buildStatusBar();
        this.buildPlayground();
        this.run = true;
        this.begun = true;
        this.infoPane.style.display = 'none';
    };

    stop() {
        this.run = false;
        this.finished = true;
        this.infoPane.style.display = 'block';
        this.score = computeScore(this.getState());
        this.infoPane.setAttribute('id', 'win');
        this.infoPane.innerHTML = "<p><span id='emp'>Congratulations,<br>" +
            this.name +
            "!</span><br><br>" +
            "Your time is " +  this.time.h + ":" + this.time.m + ":" + this.time.s + ".<br>" +
            "Your moves number is " + this.moves + ".<br>" +
            "Your score is " + this.score + ".<br><br>" +
            "<span id='sub'>Press esc to start a new game.</span><br>" +
            "<span id='sub'>Press S to show the game scores.</span></p>";
        let d = new Date();
        this.timestamp = d.toLocaleString();

        this.sendScores();
    };

    pause() {
        this.run = false;
        this.infoPane.style.display = 'block';
        this.infoPane.innerHTML = "<p><span>Game paused.</span><br><br>" +
            "<span id='sub'>Press space to continue.</span><br>" +
            "<span id='sub'>Press esc to start a new game.</span><br>" +
            "<span id='sub'>Press S to show the game scores.</span></p>";
    };

    proceed() {
        this.run = true;
        this.begun = true;
        this.infoPane.style.display = 'none';
        if (this.interval === null)
            runTimer(this);
    }

    /* Udalosti */
    keyPress(event) {
        const keyName = event.key;

        event = event || window.event;
        let target = event.target || event.srcElement;
        let targetTagName = '';
        if (target.nodeType === 1)
            targetTagName = target.nodeName.toUpperCase();
        if (/INPUT|SELECT|TEXTAREA/.test(targetTagName)) {
            if (keyName === 'Enter')
                this.setPlayersName();
            return
        }

        if (keyName === 's' || keyName === 'S')
            this.toggleGameScores();
        if (this.run === true) {
            if (keyName === ' ' || keyName === 'Spacebar')
                this.pause();
            else if (keyName === 'ArrowUp' || keyName === 'ArrowDown' ||
                    keyName === 'ArrowLeft' || keyName === 'ArrowRight')
                this.handleMove(event);
        }
        else {
            if (this.begun === false && this.finished === false && (keyName === ' ' || keyName === 'Spacebar' ||
                keyName === 'ArrowUp' || keyName === 'ArrowDown' ||
                keyName === 'ArrowLeft' || keyName === 'ArrowRight'))
                this.proceed();
            else if (this.begun === true && this.finished === false && (keyName === ' ' || keyName === 'Spacebar'))
                this.proceed();
            else if (this.begun === true && keyName === 'Escape') {
                this.infoPane.removeAttribute('id');
                this.start();
            }
        }
    }

    handleMove(event) {
        let blank = document.getElementById('cell--blank');
        let blank_ix = this.poss.indexOf(0);
        let num_ix = null;

        switch (event.key) {
            case 'ArrowUp':
                if (blank_ix + 4 > 15) return;
                num_ix = blank_ix + 4;
                break;
            case 'ArrowDown':
                if (blank_ix - 4 < 0) return;
                num_ix = blank_ix - 4;
                break;
            case 'ArrowLeft':
                if ((blank_ix + 1) % 4 === 0) return;
                num_ix = blank_ix + 1;
                break;
            case 'ArrowRight':
                if (blank_ix % 4 === 0) return;
                num_ix = blank_ix - 1;
                break;
        }

        this.moves++;
        this.movesElem.textContent = "Moves: " + this.moves;

        let num = document.getElementById(`cell--${num_ix}`);
        this.poss = arraySwap(this.poss, blank_ix, num_ix);
        idSwap(num, 'cell--blank', blank, `cell--${blank_ix}`);
        removeAllChildren(num);
        hangLabel(blank, this.poss[blank_ix]);

        this.checkWin();
    }

    checkWin() {
        let ordered = arrayDeepCopy(this.poss);
        ordered = ordered.sort(function(o1, o2){return o1 - o2});
        ordered = ordered.slice(1, 16);
        ordered.push(0);
        if (arrayCheckEq(this.poss, ordered))
            this.stop();
    }

    setPlayersName() {
        this.name = document.getElementById('nameInput').value;
        if (this.name === '' || this.name === ' ')
            this.name = 'anonymous user';
        let info = document.getElementsByClassName('info')[0];
        info.innerHTML = "<p><span id='sub'>Use arrow keys to play.<br>" +
            "Use space to resume or pause.<br>" +
            "Press S to show or hide the game scores.</span></p>";
    }

    /* Vytvaranie elementov hry */
    buildTitle() {
        let title = document.createElement('header');
        title.classList.add('title');
        title.textContent = "15 Puzzle";
        title.style.fontSize = getHeaderSizes().fontSize;
        title.style.height = getHeaderSizes().height;
        this.rootElement.appendChild(title);
    }

    buildStatusBar() {
        let status = document.createElement('div');
        status.classList.add('status');
        status.style.top = status.style.height = getStatusSizes().height;
        status.style.fontSize = getStatusSizes().fontSize;
        this.rootElement.appendChild(status);

        this.timeElem = document.createElement('div');
        this.timeElem.classList.add('status__time');
        this.timeElem.textContent = "Time: " + this.time.h + ":" + this.time.m + ":" + this.time.s;
        status.appendChild(this.timeElem);

        this.movesElem = document.createElement('div');
        this.movesElem.classList.add('status__moves');
        this.movesElem.textContent = "Moves: " + this.moves;
        status.appendChild(this.movesElem);
    }

    buildPlayground() {
        let playground = document.createElement('div');
        this.rootElement.appendChild(playground);
        playground.classList.add('playground');

        for (let i = 0; i < 4; i++) {
            let row = document.createElement('div');
            row.classList.add('row');
            for (let j = 0; j < 4; j++) {
                let cell = document.createElement('div');
                buildCell(cell, getCellSizes().cellSize, getCellSizes().fontSize, i*4+j, this.poss[i*4+j], row);
            }
            playground.appendChild(row);
        }
    }

    buildInfoPane() {
        this.infoPane = document.createElement('div');
        this.infoPane.classList.add('info');
        let infoText = document.createElement('p');
        infoText.setAttribute('id', 'info--text');
        infoText.innerHTML = "<span id='emp'>Welcome</span><br>" +
            "to the <span>15 Puzzle</span> game!<br><br>" +
            "Enter your name: " +
            "<input type='text' name='nameInput' id='nameInput' autofocus>";
        this.infoPane.appendChild(infoText);
        let button = document.createElement('button');
        button.setAttribute('id', 'nameButton');
        button.innerHTML = '→';
        button.addEventListener('click', this.setPlayersName, false);
        infoText.appendChild(button);
        this.rootElement.appendChild(this.infoPane);
    }

    buildScorePane() {
        this.scorePane = document.createElement('div');
        this.scorePane.style.display = 'none';
        this.scorePane.classList.add('scores');
        this.rootElement.appendChild(this.scorePane);
    }

    toggleGameScores() {
        if (this.scorePane.style.display === 'none')
            this.scorePane.style.display = 'block';
        else
            this.scorePane.style.display = 'none';
    }

    /* Zdielanie game scores */
    refreshScores (data) {
        if (data.length === 0) {
            let scoresInfo = document.createElement('p');
            scoresInfo.innerHTML = '<span id="emp">No game scores yet</span>';
            this.scorePane.appendChild(scoresInfo);
            return;
        }
        removeAllChildren(this.scorePane);

        let table = document.createElement('table');
        table.classList.add('scores__table');
        table.createCaption().innerHTML = 'Game scores:';
        let THeadRow = table.createTHead().insertRow(0);
        THeadRow.insertCell(0).innerHTML = 'Name';
        THeadRow.insertCell(1).innerHTML = 'Score';
        THeadRow.insertCell(2).innerHTML = 'Date';
        this.scorePane.appendChild(table);

        let TBody = table.createTBody();
        for (let i = 0; i < data.length; i++) {
            let TBodyRow = TBody.insertRow(0);
            TBodyRow.insertCell(0).innerHTML = data[i].name;
            TBodyRow.insertCell(1).innerHTML = data[i].score;
            TBodyRow.insertCell(2).innerHTML = data[i].timestamp;
        }
    }

    sendScores () {
        let data = {};
        data.name = this.name;
        data.score = this.score;
        data.timestamp = this.timestamp;

        socket.emit ('data', data);
    }
}

/* Samostatná funkcia na výpočet skóre, ktorá bude využitá aj na strane servera.*/
function computeScore (gameState) {
    /* Vrati reálne číslo z intervalu <0,100> t.j. percentuálnu úspešnosť. */
    /* Prípadne -1 ak skóre ešte nemožno spočítať. */
    /* Vyhra za <1 minutu - 100%, za >30 minut - 0% */

    if (gameState === undefined || gameState === null) return -1;
    let stateData = JSON.parse(gameState);
    let finished = parseBoolean(stateData.state[0].finished);
    if (finished === false) return -1;

    let timeSec = timeToSeconds(stateData.state[0].time);
    if (timeSec < 60) return 100;
    if (timeSec > 1800) return 0;
    return Math.round(100 - ((timeSec - 60) / 1740 * 100));
}

function generateState() {
    /*Custom*/
    let positions = [
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10,11,0,
        13,14,15,12];

    /*Completed*/
    // let positions = [...Array(16).keys()];
    // positions = positions.slice(1, 16);
    // positions.push(0);

    /*Random*/
    // let positions = [...Array(16).keys()];
    // arrayShuffle(positions);

    return '{ "state" : [{\n' +
        '"name": "null",\n' +
        '"timestamp": "null",\n' +
        '"positions": "' + positions.join('-') + '",\n' +
        '"time": "0:0:0",\n' +
        '"moves": "0",\n' +
        '"score": "0",\n' +
        '"finished": "false" } ]}';
}

function parseBoolean(booleanString) {
    return booleanString === 'true';
}

function timeToSeconds(time) {
    let timeArr = time.split(':');
    return parseInt(timeArr[0]) * 24 + parseInt(timeArr[1]) * 60 + parseInt(timeArr[2]);
}

function arrayCheckEq(arr1, arr2) {
    if(arr1.length !== arr2.length)
        return false;
    for(let i = arr1.length; i--;) {
        if(arr1[i] !== arr2[i])
            return false;
    }
    return true;
}

function arrayDeepCopy(oldArr) {
    let newArr = [];
    Array.prototype.forEach.call(oldArr, function (el) { newArr.push(el); });
    return newArr;
}

function runTimer(elem) {
    elem.interval = setInterval(function () {
        if (elem.run) {
            update(elem.time, 's');
            elem.timeElem.textContent = "Time: " + elem.time.h + ":" + elem.time.m + ":" + elem.time.s;
        }
    }, 1000);
}

function update(time, type) {
    time[type]++;
    time[type] = time[type] % 60;
    if (time[type] === 0)
        type === 's' ? update(time, 'm') : update(time, 'h');
}

function getHeaderSizes() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (width < 390 || height < 460)
        return {height: '25px', fontSize: '1.5em'};
    else if (width < 450 || height < 530)
        return {height: '30px', fontSize: '2em'};
    return {height: '40px', fontSize: '2.5em'};
}

function getStatusSizes() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (width < 390 || height < 460)
        return {height: '20px', fontSize: '1em'};
    else if (width < 450 || height < 530)
        return {height: '30px', fontSize: '1.5em'};
    return {height: '40px', fontSize: '2em'};
}

function getCellSizes() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (width < 390 || height < 460)
        return {cellSize: '60px', fontSize: '3em'};
    else if (width < 450 || height < 530)
        return {cellSize: '85px', fontSize: '4em'};
    return {cellSize: '100px', fontSize: '5em'};
}

function buildCell(cell, cellSize, fontSize, ix, id, row) {
    cell.classList.add('cell');
    cell.style.textAlign = 'center';
    cell.style.fontFamily = 'Consolas, serif';
    cell.style.width = cell.style.height = cellSize;
    cell.style.fontSize = fontSize;
    cell.style.margin = '5px';
    row.appendChild(cell);
    if (id === 0)
        cell.setAttribute('id', 'cell--blank');
    else {
        cell.setAttribute('id', `cell--${ix}`);
        hangLabel(cell, id);
    }
}

function updElem(elem, width, height, fontSize, margin, top) {
    if (elem === null || elem === undefined) return;
    if (width !== null && width !== undefined) elem.style.width = width;
    if (height !== null && height !== undefined) elem.style.height = height;
    if (fontSize !== null && fontSize !== undefined) elem.style.fontSize = fontSize;
    if (margin !== null && margin !== undefined) elem.style.margin = margin;
    if (top != null && top !== undefined) elem.style.top = top;
}

function hangLabel(elem, text) {
    let label = document.createElement('div');
    label.classList.add('label');
    label.textContent = text;
    elem.appendChild(label);
}

function arrayShuffle(array) {
    //http://sedition.com/perl/javascript-fy.html
    let currentIndex = array.length, temporaryValue, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}

function arraySwap(arr, ix1, ix2) {
    let t = arr[ix1];
    arr[ix1] = arr[ix2];
    arr[ix2] = t;

    return arr;
}

function idSwap(elem1, id1, elem2, id2) {
    elem1.removeAttribute('id');
    elem1.setAttribute('id', id1);
    elem2.removeAttribute('id');
    elem2.setAttribute('id', id2);
}

function removeAllChildren(element) {
    while (element.firstChild)
        element.removeChild(element.firstChild);
}



document.addEventListener ('DOMContentLoaded', () => {
    let root = document.getElementsByClassName('root')[0];
    let cfg = generateState();

    let puzzle = new Puzzle15(root, cfg);
});