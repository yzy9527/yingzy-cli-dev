'use strict';
const simpleGit = require('simple-git');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const log = require('@yingzy-cli-dev/log');
const userHome = os.homedir();
const terminalLink = require('terminal-link');
const {readFile, writeFile} = require('@yingzy-cli-dev/utils');
const inquirer = require('inquirer');
const Github = require('./Github');
const Gitee = require('./Gitee');

const GIT_SERVER_FILE = '.git_server';
const GIT_ROOT_DIR = '.git';
const GIT_TOKEN_FILE = '.git_token';
const DEFAULT_CLI_HOME = '.yingzy-cli-dev';
const GITHUB = 'github';
const GITEE = 'gitee';
const GIT_SERVER_TYPE = [{
    name: 'Github',
    value: GITHUB
}, {
    name: 'Gitee',
    value: GITEE
}];

class Git {
    constructor({name, version, dir}, {refreshServer = false, refreshToken = false}) {
        this.name = name;
        this.version = version;
        this.dir = dir;
        this.git = simpleGit();
        this.gitServer = null;
        this.homePath = null;
        this.user = null;
        this.orgs = null; //组织
        this.refreshServer = refreshServer;
        this.refreshToken = refreshToken;
    }

    async prepare() {
        try {
            this.checkHomePath();//检查主目录
            await this.checkGitServer();//检查用户远程仓库类型
            await this.checkGitToken();
            await this.getUserAndOrgs();//获取远程仓库和用户
        } catch (e) {
            log.error(e.message);
            if (process.env.LOG_LEVEL === 'verbose') {
                console.log(e);
            }
        }
    }

    checkHomePath() {
        if (!this.homePath) {
            if (process.env.CLI_HOME_PATH) {
                this.homePath = process.env.CLI_HOME_PATH;
            } else {
                this.homePath = path.resolve(userHome, DEFAULT_CLI_HOME);
            }
        }
        log.verbose('userHome', this.homePath);
        fse.ensureDirSync(this.homePath);
        if (!fs.existsSync(this.homePath)) {
            throw new Error('用户主目录获取失败！');
        }
    }

    async checkGitServer() {
        const gitServerPath = this.createPath(GIT_SERVER_FILE);
        let gitServer = readFile(gitServerPath);
        if (!gitServer || this.refreshServer) {
            gitServer = (await inquirer.prompt({
                type: 'list',
                name: 'gitServer',
                default: GITHUB,
                message: '请选择要托管的git平台',
                choices: GIT_SERVER_TYPE
            })).gitServer;
            writeFile(gitServerPath, gitServer, this.refreshServer);
            log.success('.git server 写入成功', `${gitServer} -> ${gitServerPath}`);
            console.log(gitServer);
        } else {
            log.success('.git server 获取成功', gitServer);
        }
        this.gitServer = this.createGitServer(gitServer);
        if (!this.gitServer) {
            throw new Error('gitServer初始化失败');
        }
    }

    async checkGitToken() {
        const tokenPath = this.createPath(GIT_TOKEN_FILE);
        let token = readFile(tokenPath);
        if (!token || this.refreshToken) {
            log.warn(this.gitServer.type + ' token 未生成', '请先生成 ' + this.gitServer.type + ' token，' +
                terminalLink('参考文档', this.gitServer.getTokenHelpUrl()));

            token = (await inquirer.prompt({
                type: 'password',
                name: 'token',
                default: '',
                message: '请将token复制到此处'
            })).token;
            writeFile(tokenPath, token);
            log.success('token写入成功', `${token} -> ${tokenPath}`);
        } else {
            log.success('token获取成功', `${tokenPath}`);
        }
        this.token = token;
        this.gitServer.setToken(token);
    }

    createGitServer(gitServer) {
        if (gitServer === GITHUB) {
            return new Github();
        } else if (gitServer === GITEE) {
            return new Gitee();
        }
        return null;
    }

    async getUserAndOrgs() {
        this.user = await this.gitServer.getUser();
        // console.log(this.user);
        if (!this.user) {
            throw new Error('用户信息获取失败！');
        }
        this.orgs = await this.gitServer.getOrg(this.user.login);
        if (!this.orgs) {
            throw new Error('组织信息获取失败！');
        }
        // console.log('ss',this.orgs);
    }

    createPath(file) {
        //生成.gitServer文件
        const rootDir = path.resolve(this.homePath, GIT_ROOT_DIR);
        const filePath = path.resolve(rootDir, file);
        fse.ensureFileSync(filePath);
        return filePath;
    }


    init() {
        console.log('init');
    }
}

module.exports = Git;
