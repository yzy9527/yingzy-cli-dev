'use strict';

const io = require('socket.io-client');
const log = require('@yingzy-cli-dev/log');

const WS_SERVER = 'http://127.0.0.1:7001';
const TIME_OUT = 5 * 60;
const CONNECT_TIME_OUT = 5 * 1000;

class CloudBuild {
    constructor(git, options) {
        this.git = git;
        this.buildCmd = options.buildCmd;
        this.timeout = TIME_OUT;
    }

    doTimeout(fn, timeout) {
        this.timer && clearTimeout(this.timer);
        log.info(`设置任务超时时间：${timeout / 1000}秒`);
        this.timer = setTimeout(fn, timeout);
    }

    init() {
        const socket = io(WS_SERVER, {
            query: {
                repo: this.git.remote
            }
        });
        socket.on('connect', () => {
            console.log('connect!');
        });
        const disconnect = () => {
            clearTimeout(this.timer);
            socket.disconnect();
            socket.close();
        };
        this.doTimeout(() => {
            log.error('云构建连接超时，自动终止');
            disconnect();
        }, CONNECT_TIME_OUT);
    }
}

// const socket = require('socket.io-client')('http://127.0.0.1:7001');
//
// socket.on('connect', () => {
//     console.log('connect!');
//     socket.emit('chat', 'hello world!');
// });
//
// socket.on('res', msg => {
//     console.log('res from server: %s!', msg);
// });
module.exports = CloudBuild;
