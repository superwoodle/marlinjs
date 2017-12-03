const SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;
const serialLog = require('debug')('marlinjs:serial-rx')
const log = require('debug')('marlinjs:log');
const serialWriteLog = require('debug')('marlinjs:serial-tx');

const queueBufferSize = 20; // Load lines into memory
const queueBufferChunkSize = 10; // Load queue when it get low

var lineByLine = require('n-readlines');

function Device(port, buadRate) {
    this._serial = new SerialPort(port, {
        baudRate: buadRate
    });
    this._ready = false;
    this._queue = [];
    this._busy = false;
    this._current = null;
    this._queueCallback = null;

    var device = this;
    const parser = this._serial.pipe(new Readline({ delimiter: '\n' }));
    parser.on('data', function (data) {
        serialLog(data.toString());
        if (!device._current) return;
        if (data.toString() === ('ok')) {
            device._current = null;
            device.processQueue();
        }
    })
    this._serial.on('open', () => {
        const _this = this;
        log('Port Open.');
        setTimeout(() => {
            this.send('M115');
            this._ready = true;
        }, 5000);
    });
}

Device.prototype.isReady = function () {
    return this._ready;
};

Device.prototype.send = function (command, comment) {
    this._queue.push({ command, comment });
    if (this._busy) return;
    this._busy = true;
    this.processQueue();
};

Device.prototype.printFile = function (file) {
    log('Printing');
    var liner = new lineByLine(file);
    this.setProcessQueueCallback(() => {
        if (this._queue.length <= queueBufferChunkSize) {
            log('Reloading the queue...');
            let count = 0;
            while (this._queue.length < queueBufferSize) {
                let line = liner.next().toString('ascii');
                let comment = null;
                if (line === 'false') {
                    log("File Complete");
                    this.setProcessQueueCallback(null)
                    return;
                }
                if (line.includes(';')) {
                    const parts = line.split(';');
                    line = parts[0];
                    comment = parts[1];
                }
                if (!line || line === 'false' || !line.replace(/\s/g, '').length) continue;
                this.send(line, comment);
                count++;
            }
            log(`Queue loaded with ${count} commands.`);
        }
    })
    this.processQueue();
}

Device.prototype.setProcessQueueCallback = function (callback) {
    this._queueCallback = callback;
};

Device.prototype.processQueue = function () {
    var next = this._queue.shift();
    if (!next) {
        this._busy = false;
        if (this._queueCallback) this._queueCallback();
        return;
    }
    this._current = next;
    serialWriteLog(next.command + (next.comment ? ` ;${next.comment}` : ''));
    this._serial.write(`${next.command}\n`);
    if (this._queueCallback) this._queueCallback();
};

module.exports = Device;