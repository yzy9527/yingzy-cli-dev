'use strict';
const simpleGit = require('simple-git');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const log = require('@yingzy-cli-dev/log');
const userHome = os.homedir();
const terminalLink = require('terminal-link');
const {readFile, writeFile, spinnerStart} = require('@yingzy-cli-dev/utils');
const inquirer = require('inquirer');
const Github = require('./Github');
const Gitee = require('./Gitee');

const GIT_SERVER_FILE = '.git_server';
const GIT_ROOT_DIR = '.git';
const GIT_TOKEN_FILE = '.git_token';
const GIT_OWN_FILE = '.git_own';
const GIT_LOGIN_FILE = '.git_login'; //判断是个人登录还是组织登录
const DEFAULT_CLI_HOME = '.yingzy-cli-dev';
const GITHUB = 'github';
const GITEE = 'gitee';
const REPO_OWNER_USER = 'user';
const REPO_OWNER_ORG = 'org';
const GIT_SERVER_TYPE = [{
    name: 'Github',
    value: GITHUB
}, {
    name: 'Gitee',
    value: GITEE
}];

const GIT_OWN_TYPE = [{
    name: '个人',
    value: REPO_OWNER_USER
}, {
    name: '组织',
    value: REPO_OWNER_ORG
}];

const GIT_OWN_TYPE_ONLY = [{
    name: '个人',
    value: REPO_OWNER_USER
}];

class Git {
    constructor({name, version, dir}, {
        refreshServer = false,
        refreshToken = false,
        refreshOwner = false
    }) {
        this.name = name; //项目名称
        this.version = version; //版本号
        this.dir = dir; //源码目录
        this.git = simpleGit(); //simpleGit 实例
        this.gitServer = null;//gitServer实例
        this.homePath = null;//本地缓存目录
        this.user = null; //用户信息
        this.orgs = null; //组织列表
        this.owner = null; //远程仓库类型（个人user还是组织org）
        this.login = null; //远程仓库登录名
        this.refreshServer = refreshServer; //是否重新选取远程仓库类型
        this.refreshToken = refreshToken; //是否重新设置远程仓库token
        this.refreshOwner = refreshOwner; //是否重新设置远程仓库类型
    }

    async prepare() {
        try {
            this.checkHomePath();//检查主目录
            await this.checkGitServer();//检查用户远程仓库类型
            await this.checkGitToken();
            await this.getUserAndOrgs();//获取远程仓库和用户
            await this.checkGitOwner(); //确认远程仓库类型
            await this.checkRepo(); //检查并创建远程仓库
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
                terminalLink('参考文档', this.gitServer.getTokenUrl()));

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

    async checkGitOwner() {
        const ownPath = this.createPath(GIT_OWN_FILE);
        const loginPath = this.createPath(GIT_LOGIN_FILE);
        let owner = readFile(ownPath);
        let login = readFile(loginPath);
        if (!owner || !login || this.refreshOwner) {
            owner = (await inquirer.prompt({
                type: 'list',
                name: 'owner',
                default: REPO_OWNER_USER,
                message: '请选择要远程仓库类型',
                choices: this.orgs.length > 0 ? GIT_OWN_TYPE : GIT_OWN_TYPE_ONLY
            })).owner;
            if (owner === REPO_OWNER_USER) {
                login = this.user.login;
            } else {
                login = (await inquirer.prompt({
                    type: 'list',
                    name: 'login',
                    message: '请选择远程仓库',
                    choices: this.orgs.map(item => ({
                        name: item.login,
                        value: item.login
                    }))
                })).login;
            }
            writeFile(ownPath, owner);
            writeFile(loginPath, login);
            log.success('owner写入成功', `${owner} -> ${ownPath}`);
            log.success('login写入成功', `${login} -> ${loginPath}`);
        } else {
            log.success('owner获取成功', `${owner}`);
            log.success('login获取成功', `${login}`);
        }
        this.owner = owner;
        this.login = login;
    }

    async checkRepo() {
        let repo = await this.gitServer.getRepo(this.login, this.name);
        if (!repo) {
            let spinner = spinnerStart('开始创建远程仓库...');
            try {
                if (this.owner === REPO_OWNER_USER) {
                    repo = await this.gitServer.createRepo(this.name);
                } else {
                    this.gitServer.createOrgRepo(this.name, this.login);
                }

            } catch (e) {
                console.log(e);
            } finally {
                spinner.stop(true);
                log.success('创建远程仓库成功');
            }
        }
    }

    init() {
        console.log('init');
    }
}

module.exports = Git;
