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
const request = require('@yingzy-cli-dev/request');
const Listr = require('Listr');
const {Observable} = require('rxjs');

const GIT_SERVER_FILE = '.git_server';
const GIT_ROOT_DIR = '.git';
const GIT_TOKEN_FILE = '.git_token';
const GIT_OWN_FILE = '.git_own';
const GIT_LOGIN_FILE = '.git_login'; //判断是个人登录还是组织登录
const DEFAULT_CLI_HOME = '.yingzy-cli-dev';
const GIT_IGNORE_FILE = '.gitignore';
const GIT_PUBLISH_FILE = '.git_publish';
const OSS_AUTH_KEY_FILE = '.oss_auth_key';
const GITHUB = 'github';
const GITEE = 'gitee';
const REPO_OWNER_USER = 'user';
const REPO_OWNER_ORG = 'org';
const VERSION_RELEASE = 'release';//发布分支
const VERSION_DEVELOP = 'dev';
const TEMPLATE_TEMP_DIR = 'oss'; //oss下载文件缓存目录


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

const GIT_PUBLISH_TYPE = [{
    name: 'OSS',
    value: 'oss'
}];

class Git {
    constructor({name, version, dir}, {
        refreshServer = false,
        refreshToken = false,
        refreshOwner = false,
        refreshOssKey = false,
        buildCmd = '',
        prod = false,
        sshUser = '',
        sshIp = '',
        sshPath = ''
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
        this.gitPublish = null; // 静态资源服务器类型
        this.prod = prod; // 是否正式发布
        this.refreshServer = refreshServer; //是否重新选取远程仓库类型
        this.refreshToken = refreshToken; //是否重新设置远程仓库token
        this.refreshOwner = refreshOwner; //是否重新设置远程仓库类型
        this.refreshOssKey = refreshOssKey;//是否重新设置oss鉴权口令
        this.branch = null; //本地开发分支
        this.buildCmd = buildCmd; //构建命令
        this.sshUser = sshUser; //服务器的用户名
        this.sshIp = sshIp;//服务器ip
        this.sshPath = sshPath;//服务器地址
        this.ossCheckCode = null;//oss校验码
    }

    async prepare() {
        this.checkHomePath();//检查主目录
        await this.checkGitServer();//检查用户远程仓库类型
        await this.checkGitToken();
        await this.getUserAndOrgs();//获取远程仓库和用户
        await this.checkGitOwner(); //确认远程仓库类型
        await this.checkRepo(); //检查并创建远程仓库
        await this.checkGitIgnore(); //检查并创建.gitignore
        await this.init();
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
                message: '请将token复制到此处',
                validate: function (v) {
                    const done = this.async();
                    setTimeout(function () {
                        if (!v) {
                            done('token不能为空');
                            return;
                        }
                        done(null, true);
                    }, 0);
                },
                filter: function (v) {
                    return v;
                }
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
        // 4.检查未提交代码
        await this.checkNotCommitted();
        //5.切换开发分支
        await this.checkoutBranch(this.branch);
        //6.合并远程master分支和开发分支代码，本地dev合并master
        await this.pullRemoteMasterAndBranch();
        //7.将开发分支推送到远程仓库
        await this.pushRemoteRepo(this.branch);
    }

    async publish() {
        await this.preparePublish();
        const cloudBuild = new CloudBuild(this, {
            buildCmd: this.buildCmd,
            type: this.gitPublish,
            prod: this.prod
        });
        await cloudBuild.prepare();
        await cloudBuild.init();
        const ret = await cloudBuild.build();
        if (ret) {
            await this.uploadTemplate();
        }
        if (this.prod && ret) {
            await this.runCreateTagTask();
            // await this.checkTag();
            // await this.checkoutBranch('master');
            // await this.mergeBranchToMaster();//将开发分支合并到master
            // await this.pushRemoteRepo('master');//将master推送到远程分支
            // await this.deleteLocalBranch(); //删除本地开发分支
            // await this.deleteRemoteBranch(); //删除远程开发分支
        }
    }


    // 自动生成远程仓库分支
    runCreateTagTask() {
        return new Promise(resolve => {
            const delay = fn => setTimeout(fn, 1000);
            const tasks = new Listr([
                {
                    title: '自动生成远程仓库Tag',
                    task: () => new Listr([{
                        title: '创建Tag',
                        task: () => {
                            return new Observable(o => {
                                o.next('正在创建Tag...');
                                delay(() => {
                                    this.checkTag().then(() => {
                                        o.complete();
                                    });
                                });
                            });
                        }
                    },
                        {
                            title: '切换分支到master',
                            task: () => {
                                return new Observable(o => {
                                    o.next('正在切换master分支...');
                                    delay(() => {
                                        this.checkoutBranch('master').then(() => {
                                            o.complete();
                                        });
                                    });
                                });
                            }
                        },
                        {
                            title: '将开发分支代码合并到master',
                            task: () => {
                                return new Observable(o => {
                                    o.next('正在合并到master分支');
                                    delay(() => {
                                        this.mergeBranchToMaster('master').then(() => {
                                            o.complete();
                                        });
                                    });
                                });
                            }
                        },
                        {
                            title: '将代码推送到远程master',
                            task: () => {
                                return new Observable(o => {
                                    o.next('正在推送master分支...');
                                    delay(() => {
                                        this.pushRemoteRepo('master').then(() => {
                                            o.complete();
                                        });
                                    });
                                });
                            }
                        },
                        {
                            title: '删除本地开发分支',
                            task: () => {
                                return new Observable(o => {
                                    o.next('正在删除本地开发分支...');
                                    delay(() => {
                                        this.deleteLocalBranch().then(() => {
                                            o.complete();
                                        });
                                    });
                                });
                            }
                        },
                        {
                            title: '删除远程开发分支',
                            task: () => {
                                return new Observable(o => {
                                    o.next('正在删除远程开发分支...');
                                    delay(() => {
                                        this.deleteRemoteBranch().then(() => {
                                            o.complete();
                                        });
                                    });
                                });
                            }
                        }
                    ])
                }]);
            tasks.run().then(res => {
                resolve();
            }).catch(err => {
                throw new Error(err);
            });
        });
    }


    async deleteLocalBranch() {
        // log.info('开始删除本地开发分支', this.branch);
        await this.git.deleteLocalBranch(this.branch);
        // log.success('删除本地开发分支成功', this.branch);
    }

    async deleteRemoteBranch() {
        // log.info('开始删除远程开发分支', this.branch);
        await this.git.push(['origin', '--delete', this.branch]);
        // log.success('删除远程开发分支成功', this.branch);

    }

    async mergeBranchToMaster() {
        // log.info('开始合并代码', `[${this.branch}] -> [master]`);
        await this.git.mergeFromTo(this.branch, 'master');
        // log.success('代码合并成功', `[${this.branch}] -> [master]`);
    }

    async checkTag() {
        // log.info('获取远程 tag 列表');
        const tag = `${VERSION_RELEASE}/${this.version}`;
        const tagList = await this.getRemoteBranchList(VERSION_RELEASE);
        if (tagList.includes(this.version)) {
            // log.success('远程分支已存在', tag);
            await this.git.push(['origin', `:refs/tags${tag}`]);
            // log.success('远程分支已删除');
        }
        const localTagList = await this.git.tags();
        if (localTagList.all.includes(tag)) {
            // log.success('本地分支已存在', tag);
            await this.git.tag(['-d', tag]);
            // log.success('本地分支已删除');
        }
        await this.git.addTag(tag);
        // log.success('本地 tag 创建成功', tag);
        await this.git.pushTags('origin');
        // log.success('远程 tag 推送成功', tag);
    }

    async uploadTemplate() {
        const TEMPLATE_FILE_NAME = 'index.html';
        if (this.sshUser && this.sshIp && this.sshPath) {
            log.info('开始下载模板');
            let ossTemplateFile = await request({
                url: '/oss/get',
                params: {
                    type: this.prod ? 'prod' : 'dev',
                    name: this.name,
                    file: TEMPLATE_FILE_NAME
                }
            });
            if (ossTemplateFile.code === 0 && ossTemplateFile.data) {
                ossTemplateFile = ossTemplateFile.data;
            }
            let response = await request({
                url: ossTemplateFile.url
            });
            log.verbose('模板文件地址：', ossTemplateFile.url);
            if (response) {
                const ossTempDir = path.resolve(this.homePath, TEMPLATE_TEMP_DIR, `${this.name}@${this.version}`);
                if (!fs.existsSync(ossTempDir)) {
                    fse.mkdirpSync(ossTempDir);
                } else {
                    fse.emptyDirSync(ossTempDir);
                }
                const templateFilePath = path.resolve(ossTempDir, TEMPLATE_FILE_NAME);
                fse.createFileSync(templateFilePath);
                fs.writeFileSync(templateFilePath, response);
                log.success('模板文件下载成功', templateFilePath);
                log.info('开始上传模板文件到服务器');
                const uploadCmd = `scp -r ${templateFilePath} ${this.sshUser}@${this.sshIp}:${this.sshPath}`;
                log.verbose('uploadCmd', uploadCmd);
                const ret = require('child_process').execSync(uploadCmd);
                console.log(ret.toString());
                log.success('模板文件上传成功');
                fse.emptyDirSync(ossTempDir);
            }
        }
    }

    async preparePublish() {
        log.info('开始进行云构建前代码检查');
        const pkg = this.getPackageJson();
        if (this.buildCmd) {
            const buildCmdArray = this.buildCmd.split(' ');
            if (!['npm', 'cnpm'].includes(buildCmdArray[0])) {
                throw new Error('build命令非法，必须使用npm或cnpm');
            }
        } else {
            this.buildCmd = 'npm run build';
        }
        const buildAmdArray = this.buildCmd.split(' ');
        const lastCmd = buildAmdArray[buildAmdArray.length - 1];
        if (!pkg.scripts || !Object.keys(pkg.scripts).includes(lastCmd)) {
            throw new Error(this.buildCmd + '命令不存在');
        }
        log.info('云构建代码检查通过');
        const gitPublishPath = this.createPath(GIT_PUBLISH_FILE);
        let gitPublish = readFile(gitPublishPath);
        if (!gitPublish) {
            gitPublish = (await inquirer.prompt({
                type: 'list',
                choices: GIT_PUBLISH_TYPE,
                message: '请选择您想要上传代码的平台',
                name: 'gitPublish'
            })).gitPublish;
            writeFile(gitPublishPath, gitPublish);
            log.success('git publish类型写入成功', `${gitPublish} -> ${gitPublishPath}`);
        } else {
            log.success('git publish类型获取成功', gitPublish);
        }
        this.gitPublish = gitPublish;
        await this.checkAccount(gitPublish)
    }

    async checkAccount(gitPublish){
        if(gitPublish==='oss') {
            const ossAuthKeyFile = this.createPath(OSS_AUTH_KEY_FILE);
            let ossAuthKey = readFile(ossAuthKeyFile);
            if (!ossAuthKey || this.refreshOssKey) {
                ossAuthKey = (await inquirer.prompt({
                    type: 'input',
                    name: 'checkCode',
                    defaultValue: '',
                    message: `oss上传密钥：`,
                    validate: function (v) {
                        const done = this.async();
                        setTimeout(function () {
                            if (!v) {
                                done('请输入密钥：');
                                return;
                            }
                            done(null, true);
                        }, 0);
                    },
                    filter: function (v) {
                        return v;
                    }
                })).checkCode;
                writeFile(ossAuthKeyFile, ossAuthKey);
                log.success('ossAuthKey写入成功', `${ossAuthKey} -> ${ossAuthKeyFile}`);
            }else {
                log.success('ossAuthKey类型获取成功');
                log.verbose('ossAuthKey', ossAuthKey)
            }
            this.ossCheckCode = ossAuthKey
        }
    }

    getPackageJson() {
        const pkgPath = path.resolve(this.dir, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            throw new Error(`源码目录${this.dir}：package.json 不存在`);
        }
        return fse.readJsonSync(pkgPath);
    }

    async pullRemoteMasterAndBranch() {
        log.info(`合并 [master] -> [${this.branch}]`);
        await this.pullRemoteRepo('master');
        log.success('合并远程[master]分支代码成功');
        await this.checkConflicted();
        log.info('检查远程开发分支');
        const remoteBranchList = await this.getRemoteBranchList();
        if (remoteBranchList.indexOf(this.version) >= 0) {
            log.info(`合并远程 [${this.branch}] -> 本地[${this.branch}]`);
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
        // log.success('分支已切换到' + branch);
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
        log.verbose('本地版本号：', this.version);
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
        // log.info(`推送代码到${branchName}分支`);
        await this.git.push('origin', branchName);
        // log.success('代码推送成功');
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
            // log.verbose('status', status);
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
