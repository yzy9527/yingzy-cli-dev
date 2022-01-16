'use strict';
const simpleGit = require('simple-git');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const semver = require('semver');
const userHome = os.homedir();
const terminalLink = require('terminal-link');
const log = require('@yingzy-cli-dev/log');
const {readFile, writeFile, spinnerStart} = require('@yingzy-cli-dev/utils');
const inquirer = require('inquirer');
const Github = require('./Github');
const Gitee = require('./Gitee');
const CloudBuild = require('@yingzy-cli-dev/cloudbuild');

const GIT_SERVER_FILE = '.git_server';
const GIT_ROOT_DIR = '.git';
const GIT_TOKEN_FILE = '.git_token';
const GIT_OWN_FILE = '.git_own';
const GIT_LOGIN_FILE = '.git_login'; //判断是个人登录还是组织登录
const DEFAULT_CLI_HOME = '.yingzy-cli-dev';
const GIT_IGNORE_FILE = '.gitignore';
const GITHUB = 'github';
const GITEE = 'gitee';
const REPO_OWNER_USER = 'user';
const REPO_OWNER_ORG = 'org';
const VERSION_RELEASE = 'release';//发布分支
const VERSION_DEVELOP = 'dev';


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
        refreshOwner = false,
        buildCmd = ''
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
        this.repo = null; //远程仓库对象
        this.refreshServer = refreshServer; //是否重新选取远程仓库类型
        this.refreshToken = refreshToken; //是否重新设置远程仓库token
        this.refreshOwner = refreshOwner; //是否重新设置远程仓库类型
        this.branch = null; //本地开发分支
        this.buildCmd = buildCmd; //构建命令
    }

    async prepare() {
        try {
            this.checkHomePath();//检查主目录
            await this.checkGitServer();//检查用户远程仓库类型
            await this.checkGitToken();
            await this.getUserAndOrgs();//获取远程仓库和用户
            await this.checkGitOwner(); //确认远程仓库类型
            await this.checkRepo(); //检查并创建远程仓库
            await this.checkGitIgnore(); //检查并创建.gitignore
            await this.init();
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
        // console.log('repo',repo);
        if (!repo) {
            let spinner = spinnerStart('开始创建远程仓库...');
            try {
                if (this.owner === REPO_OWNER_USER) {
                    repo = await this.gitServer.createRepo(this.name);
                } else {
                    repo = await this.gitServer.createOrgRepo(this.name, this.login);
                }

            } catch (e) {
                console.log(e);
            } finally {
                spinner.stop(true);
            }
            if (repo) {
                log.success('远程仓库创建成功');
            } else {
                throw new Error('远程仓库创建失败');
            }
        } else {
            log.success('远程仓库信息获取成功');
        }
        this.repo = repo;
    }

    checkGitIgnore() {
        const gitIgnore = path.resolve(this.dir, GIT_IGNORE_FILE);
        if (!fs.existsSync(gitIgnore)) {
            writeFile(gitIgnore, `.DS_Store
node_modules
/dist


# local env files
.env.local
.env.*.local

# Log files
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Editor directories and files
.idea
.vscode
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`);
            log.success(`自动写入${GIT_IGNORE_FILE}文件成功`);
        }
    }

    async init() {
        if (await this.getRemote()) {
            return;
        }
        await this.initAndAddRemote();
        await this.initCommit();
    }

    async commit() {
        // 1.生成开发分支
        await this.getCorrectVersion();
        //2.在开发分支上提交代码,检查开发分支
        await this.checkStash();
        // 3.检查代码冲突
        await this.checkConflicted();
        //4.切换开发分支
        await this.checkoutBranch(this.branch);
        //5.合并远程master分支和开发分支代码，本地dev合并master
        await this.pullRemoteMasterAndBranch();
        //6.将开发分支推送到远程仓库
        await this.pushRemoteRepo(this.branch);
    }

    async publish() {
        await this.preparePublish();
        const cloudBuild = new CloudBuild(this, {
            buildCmd: this.buildCmd
        });
        cloudBuild.init();
    }

    async preparePublish() {
        if (this.buildCmd) {
            const buildCmdArray = this.buildCmd.split(' ');
            if (!['npm', 'cnpm'].includes(buildCmdArray[0])) {
                throw new Error('build命令非法，必须使用npm或cnpm');
            }
        } else {
            this.buildCmd = 'npm run build';
        }
    }

    async pullRemoteMasterAndBranch() {
        log.info(`合并 [master] -> [${this.branch}]`);
        await this.pullRemoteRepo('master');
        log.success('合并远程[master]分支代码成功');
        await this.checkConflicted();
        log.info('检查远程开发分支');
        const remoteBranchList = await this.getRemoteBranchList();
        if (remoteBranchList.indexOf(this.version) >= 0) {
            log.info(`合并 [${this.branch}] -> [${this.branch}]`);
            await this.pullRemoteRepo(this.branch);
            log.success(`合并远程 [${this.branch}] 分支代码成功`);
            await this.checkConflicted();
        } else {
            log.success(`不存在远程分支 [${this.branch}]`);
        }

    }

    async checkoutBranch(branch) {
        const localBranchList = await this.git.branchLocal();
        if (localBranchList.all.indexOf(branch) >= 0) {
            await this.git.checkout(branch);
        } else {
            await this.git.checkoutLocalBranch(branch);
        }
        log.success('分支已切换到' + branch);
    }

    async checkStash() {
        log.info('检查stash记录');
        const stashList = await this.git.stashList();
        if (stashList.all.length > 0) {
            await this.git.stash(['pop']);
            log.success('stash pop成功');
        }
    }

    async getCorrectVersion(type) {
        // 1.获取远程分布分支
        // 版本号规范：release/x.y.z，dev/x.y.z
        // 版本号递增规范：major/minor/patch
        log.info('获取代码分支');
        const remoteBranchList = await this.getRemoteBranchList(VERSION_RELEASE);
        let releaseVersion = null;
        if (remoteBranchList && remoteBranchList.length > 0) {
            releaseVersion = remoteBranchList[0];
        }
        log.verbose('线上最新版本号：', releaseVersion);
        // 2.生成本地开发分支
        const devVersion = this.version;
        if (!releaseVersion) {
            this.branch = `${VERSION_DEVELOP}/${devVersion}`;
        } else if (semver.gt(this.version, releaseVersion)) {
            //存在远程版本号
            log.info('当前版本大于线上版本', `${devVersion} >= ${releaseVersion}`);
            this.branch = `${VERSION_DEVELOP}/${devVersion}`;
        } else {
            log.info('线上版本大于本地版本', `${releaseVersion} > ${devVersion}`);
            const increaseType = (await inquirer.prompt({
                type: 'list',
                name: 'increaseType',
                message: '自动升级版本，请选择要升级的类型',
                choices: [{
                    name: `小版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'patch')}）`,
                    value: 'patch'
                }, {
                    name: `中版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'minor')}）`,
                    value: 'minor'
                }, {
                    name: `大版本（${releaseVersion} -> ${semver.inc(releaseVersion, 'major')}）`,
                    value: 'major'
                }]
            })).increaseType;
            const increaseVersion = semver.inc(releaseVersion, increaseType);
            this.branch = `${VERSION_DEVELOP}/${increaseVersion}`;
            this.version = increaseVersion;
        }
        log.verbose('本地开发分支：', this.branch);
        this.syncVersionToPackageJson();
    }

    syncVersionToPackageJson() {
        // 将版本号同步写入到package.json
        const pkg = fse.readJsonSync(`${this.dir}/package.json`);
        if (pkg && pkg.version !== this.version) {
            pkg.version = this.version;
            fse.writeJsonSync(`${this.dir}/package.json`, pkg, {spaces: 2});
        }
    }

    async getRemoteBranchList(type) {
        const remoteList = await this.git.listRemote(['--refs']);
        let reg;
        if (type === VERSION_RELEASE) {
            reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g;
        } else {
            reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g;
        }
        return remoteList.split('\n').map(remote => {
            const match = reg.exec(remote);
            // 如果存在多个版本号，只会获取第一个，需要将lastIndex置为0
            reg.lastIndex = 0;
            if (match && semver.valid(match[1])) {
                // 版本号
                return match[1];
            }
        }).filter(_ => _)
            .sort((a, b) => {
                //将最新的版本号放在第一位
                if (semver.lte(b, a)) {
                    if (a === b) return 0;
                    return -1;
                }
                return 1;
            });
    }

    async initCommit() {
        await this.checkConflicted();//代码冲突检查
        await this.checkNotCommitted();
        //push
        if (await this.checkRemoteMaster()) {
            //存在master
            await this.pullRemoteRepo('master', {
                '--allow-unrelated-histories': null
            });
        } else {
            await this.pushRemoteRepo('master');
        }
    }

    async pullRemoteRepo(branchName, options) {
        log.info(`同步远程${branchName}分支代码`);
        await this.git.pull('origin', branchName, options)
            .catch(e => {
                log.error(e.message);
            });
    }

    async pushRemoteRepo(branchName) {
        log.info(`推送代码到${branchName}分支`);
        await this.git.push('origin', branchName);
        log.success('代码推送成功');
    }

    async checkRemoteMaster() {
        return (await this.git.listRemote(['--refs'])).indexOf('refs/heads/master') >= 0;
    }

    async checkNotCommitted() {
        const status = await this.git.status();
        if (status.not_added.length > 0 ||
            status.created.length > 0 ||
            status.modified.length > 0 ||
            status.deleted.length > 0 ||
            status.renamed.length > 0
        ) {
            log.verbose('status', status);
            await this.git.add(status.not_added);
            await this.git.add(status.created);
            await this.git.add(status.deleted);
            await this.git.add(status.modified);
            await this.git.add(status.renamed);
            let message;
            while (!message) {
                //防止commit信息为空
                message = (await inquirer.prompt({
                    type: 'text',
                    name: 'message',
                    message: '请输入commit信息'
                })).message;
            }
            await this.git.commit(message);
            log.success('本次commit提交成功');
        }
    }

    async checkConflicted() {
        log.info('开始检查代码冲突...');
        const status = await this.git.status();
        if (status.conflicted.length > 0) {
            throw new Error('当前代码存在冲突，请手动处理合并后再操作！');
        }
        log.success('代码冲突检查通过');
    }

    async getRemote() {
        const gitPath = path.resolve(this.dir, GIT_ROOT_DIR);
        this.remote = this.gitServer.getRemote(this.login, this.name);
        if (fs.existsSync(gitPath)) {
            log.success('git已完成初始化');
            return true;
        } else {

        }
    }

    async initAndAddRemote() {
        log.info('开始执行git初始化');
        await this.git.init(this.dir);
        log.info('添加 git remote');
        const remotes = await this.git.getRemotes();
        if (!remotes.find(item => item.name === 'origin')) {
            await this.git.addRemote('origin', this.remote);
        }
    }
}

module.exports = Git;
