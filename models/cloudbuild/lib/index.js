'use strict';

const io = require('socket.io-client');
const log = require('@yingzy-cli-dev/log');
const get = require('lodash/get');

const WS_SERVER = 'http://127.0.0.1:7001';
const TIME_OUT = 5 * 60;
const CONNECT_TIME_OUT = 5 * 1000;


function parseMsg(msg) {
    const action = get(msg, 'data.action');
    const message = get(msg, 'data.payload.message');
    return {
        action,
        message
    };
}

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
            // 5秒内连接成功就清处定时器
            clearTimeout(this.timer);
            const {id} = socket;
            log.success('云构建任务创建成功', `任务Id:${id}`);
            socket.on(id, msg => {
                // console.log(msg);
                const parseMessage = parseMsg(msg);
                // console.log(parseMessage);
                log.success(parseMessage.action, parseMessage.message);
            });
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

        socket.on('disconnect', () => {
            log.success('disconnect', '云构建任务断开');
            disconnect();
        });

        socket.on('error', error => {
            log.error('error', '云构建出错', error);
            disconnect();
        });
    }
}

module.exports = CloudBuild;
