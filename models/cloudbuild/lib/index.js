'use strict';

const io = require('socket.io-client');
const log = require('@yingzy-cli-dev/log');
const request = require('@yingzy-cli-dev/request');
const get = require('lodash/get');
const inquirer = require('inquirer');

const WS_SERVER = 'http://api.xiaoxilao.com:7001';
const TIME_OUT = 5 * 60;
const CONNECT_TIME_OUT = 5 * 1000;

const FAILED_CODE = ['prepare failed', 'download failed', 'install failed', 'build failed', 'pre-publish failed', 'publish failed'];

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
        this.prod = options.prod;
    }

    doTimeout(fn, timeout) {
        this.timer && clearTimeout(this.timer);
        log.info(`设置任务超时时间：${timeout / 1000}秒`);
        this.timer = setTimeout(fn, timeout);
    }

    async prepare() {
        //判读是否处于正式发布
        if (this.prod) {
            // 获取oss文件
            const projectName = this.git.name;
            const projectType = this.prod ? 'prod' : 'dev';
            const ossProject = await request({
                url: '/project/oss',
                params: {
                    type: projectType,
                    name: projectName
                }
            });
            // 判断当前oss文件是否存在
            if (ossProject.code === 0 && ossProject.data.length > 0) {
                console.log('ossProject', ossProject);
                const cover = (await inquirer.prompt({
                    type: 'list',
                    name: 'cover',
                    choices: [{
                        name: '覆盖发布',
                        value: true
                    }, {
                        name: '取消发布',
                        value: false
                    }],
                    defaultValue: true,
                    message: `OSS已存在 [${projectName}] 项目，是否覆盖发布`
                })).cover;
                if (!cover) {
                    return;
                }
                //如果存在，是否覆盖

            }
        }

    }

    init() {
        return new Promise((resolve, reject) => {
            const socket = io(WS_SERVER, {
                query: {
                    repo: this.git.remote,
                    name: this.git.name,
                    branch: this.git.branch,
                    version: this.git.version,
                    buildCmd: this.buildCmd,
                    prod: this.prod
                }
            });
            socket.on('connect', () => {
                // 5秒内连接成功就清处定时器
                clearTimeout(this.timer);
                const {id} = socket;
                log.success('云构建任务创建成功', `任务Id:${id}`);
                socket.on(id, msg => {
                    const parseMessage = parseMsg(msg);
                    // console.log(parseMessage);
                    log.success(parseMessage.action, parseMessage.message);
                });
                resolve();
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
                reject(err);
            });
            this.socket = socket;
        });
    }

    build() {
        return new Promise((resolve, reject) => {
            this.socket.emit('build');
            this.socket.on('build', obj => {
                const msg = parseMsg(obj);
                if (FAILED_CODE.indexOf(msg.action) >= 0) {
                    log.error(msg.action, msg.message);
                    clearTimeout(this.timer);
                    this.socket.disconnect();
                    this.socket.close();
                } else {
                    log.success(msg.action, msg.message);
                }
            });
            this.socket.on('building', msg => {
                console.log(msg);
            });
        });
    }
}

module.exports = CloudBuild;
