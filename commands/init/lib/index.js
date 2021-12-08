'use strict';

const fs = require('fs');
const os = require('os');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const glob = require('glob');
const sermver = require('semver');
const userHome = os.homedir();
const Command = require('@yingzy-cli-dev/command');
const log = require('@yingzy-cli-dev/log');
const {spinnerStart, sleep, execAsync} = require('@yingzy-cli-dev/utils');
const Package = require('@yingzy-cli-dev/Package');

const getProjectTemplate = require('./getProjectTemplate');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

const TEMPLATE_TYPE_NORMAL = 'normal';
const TEMPLATE_TYPE_CUSTOM = 'custom';

const WHITE_COMMAND = ['npm', 'cnpm'];

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.opts().force;
        log.verbose('projectName', this.projectName);
        log.verbose('force', this.force);
    }

    async exec() {
        try {
            const projectInfo = await this.prepare();
            if (projectInfo) {
                log.verbose('projectInfo', JSON.stringify(projectInfo));
                this.projectInfo = projectInfo;
                //下载模板
                await this.downloadTemplate();
                // 安装模板
                await this.installTemplate();
            }
        } catch (e) {
            log.error(e.message);
            if (process.env.LOG_LEVEL === 'verbose') {
                console.log(e);
            }
        }
    }

    async installTemplate() {
        if (this.templateInfo) {
            if (!this.templateInfo.type) {
                this.templateInfo.type = TEMPLATE_TYPE_NORMAL;
            }
            if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
                //标准安装
                await this.installNormalTemplate();
            } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
                // 自定义安装
                await this.installCustomTemplate();
            } else {
                throw new Error('无法识别项目模板信息类别');
            }
        } else {
            throw new Error('模板信息不存在');
        }
    }

    checkCommand(cmd) {
        if (WHITE_COMMAND.includes(cmd)) {
            return cmd;
        }
        return null;
    }

    async exeCommand(command, errorMsg) {
        let ret;
        if (command) {
            const cmdArray = command.split(' ');
            const cmd = this.checkCommand(cmdArray[0]);
            if (!cmd) {
                throw new Error(command + ' 命令不存在！');
            }
            const args = cmdArray.slice(1);
            ret = await execAsync(cmd, args, {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            if (ret !== 0) {
                throw new Error(errorMsg);
            }
            return ret;
        }
    }

    async ejsRender(option) {
        const dir = process.cwd();
        const projectInfo = this.projectInfo;
        return new Promise((resolve, reject) => {
            glob('**', {
                cwd: dir,
                ignore: option.ignore,
                nodir: true
            }, (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    Promise.all(files.map(file => {
                        const filePath = path.join(dir, file);
                        return new Promise((resolve1, reject1) => {
                            ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
                                if (err) {
                                    reject1(err);
                                } else {
                                    fse.writeFileSync(filePath, result);
                                    resolve(result);
                                }
                            });
                        });
                    })).then(_ => {
                        resolve();
                    }).catch(e => {
                        reject(e);
                    });
                }
            });
        });
    }

    async installNormalTemplate() {
        // 拷贝模板到当前目录
        let spinner = spinnerStart('正在安装模板...');
        await sleep();
        try {
            const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
            const targetPath = process.cwd();
            fse.ensureDirSync(templatePath);
            fse.ensureDirSync(targetPath);
            fse.copySync(templatePath, targetPath);
        } catch (e) {
            throw e;
        } finally {
            spinner.stop(true);
            console.log('模板安装成功');
        }
        const templateIgnore = this.templateInfo.ignore || [];
        const ignore = ['**/node_modules/**', ...templateIgnore];
        await this.ejsRender({ignore});
        const {installCommand, startCommand} = this.templateInfo;
        //依赖安装
        await this.exeCommand(installCommand, '依赖安装失败！');
        //启动执行命令
        await this.exeCommand(startCommand, '启动执行失败！');
    }

    async installCustomTemplate() {
        //自定义安装'
        if (await this.templateNpm.exists()) {
            const rootFile = this.templateNpm.getRootFilePath();
            if (fs.existsSync(rootFile)) {
                log.notice('开始执行自定义模板');
                const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
                const options = {
                    templateInfo: this.templateInfo,
                    projectInfo: this.projectInfo,
                    sourcePath: templatePath,
                    targetPath: process.cwd()
                };
                const code = `require('${rootFile}')(${JSON.stringify(options)})`;
                await execAsync('node', ['-e', code], {stdio: 'inherit', cwd: process.cwd()});
                log.success('自定义模板安装成功');
            } else {
                throw new Error('自定义入口文件不存在！');
            }
        }

    }

    async downloadTemplate() {
        const {projectTemplate} = this.projectInfo;
        const templateInfo = this.template.find(item => item.npmName === projectTemplate);
        const targetPath = path.resolve(userHome, '.yingzy-cli-dev', 'template');
        const storeDir = path.resolve(userHome, '.yingzy-cli-dev', 'template', 'node_modules');
        const {npmName, version} = templateInfo;
        this.templateInfo = templateInfo;
        const templateNpm = new Package({
            targetPath,
            storeDir,
            packageName: npmName,
            packageVersion: version
        });
        if (!await templateNpm.exists()) {
            const spinner = spinnerStart('正在下载模板...');
            await sleep();
            try {
                //防止version不存在
                await templateNpm.install();
            } catch (e) {
                throw e;
            } finally {
                spinner.stop(true);
                if (await templateNpm.exists()) {
                    log.success('下载模板成功');
                    this.templateNpm = templateNpm;
                }
            }
        } else {
            const spinner = spinnerStart('正在更新模板...');
            await sleep();
            try {
                await templateNpm.update();
            } catch (e) {
                throw e;
            } finally {
                spinner.stop(true);
                if (await templateNpm.exists()) {
                    log.success('更新模板成功');
                    this.templateNpm = templateNpm;
                }
            }
        }
    }

    async prepare() {
        // 0. 判断项目模板是否存在
        const template = await getProjectTemplate();
        this.template = template;
        if (!template || template.length === 0) {
            throw Error('项目模板不存在');
        }
        //1.判断目录是否为空
        const localPath = process.cwd();
        if (!this.isDirEmpty(localPath)) {
            let ifContinue = false;
            if (!this.force) {
                ifContinue = (await inquirer.prompt({
                    type: 'confirm',
                    name: 'ifContinue',
                    message: '当前文件夹不为空，是否继续创建项目？',
                    default: false
                })).ifContinue;
                if (!ifContinue) return;
            }
            //2.是否启动强制更新
            if (ifContinue || this.force) {
                //二次确认
                const {confirmDelete} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirmDelete',
                    message: '是否清空当前目录下的文件？',
                    default: false
                });
                //清空当前目录
                if (confirmDelete) {
                    fse.emptyDirSync(localPath);
                }
            }
        }
        return this.getProjectInfo();
    }

    async getProjectInfo() {
        function isValidName(v) {
            return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9]*)/.test(v);
        }

        //3.选择性创建项目或文件
        let projectInfo = {};
        let isProjectNameValid = false;
        if (isValidName(this.projectName)) {
            isProjectNameValid = true;
            projectInfo.projectName = this.projectName;
        }

        const {type} = await inquirer.prompt({
            type: 'list',
            name: 'type',
            default: TYPE_PROJECT,
            message: '请选择初始化类型',
            choices: [{
                name: '项目',
                value: TYPE_PROJECT
            }, {
                name: '组件',
                value: TYPE_COMPONENT
            }]
        });
        const title = type === TYPE_PROJECT ? '项目' : '组件';
        this.template = this.template.filter(template => template.tag.includes(type));
        const projectNamePrompt = {
            type: 'input',
            name: 'projectName',
            default: '',
            message: `请输入${title}名称`,
            validate: function (v) {
                const done = this.async();
                setTimeout(function () {
                    if (!isValidName(v)) {
                        done('请输入合法的项目名称');
                        return;
                    }
                    done(null, true);
                }, 0);
            },
            filter: function (v) {
                return v;
            }
        };
        const projectPrompt = [];
        if (!isProjectNameValid) {
            projectPrompt.push(projectNamePrompt);
        }
        projectPrompt.push({
            type: 'input',
            name: 'projectVersion',
            default: '1.0.0',
            message: `请输入${title}版本号`,
            validate: function (v) {
                const done = this.async();
                setTimeout(function () {
                    if (!(!!sermver.valid(v))) {
                        done('请输入合法的版本号');
                        return;
                    }
                    done(null, true);
                }, 0);
            },
            filter: function (v) {
                if (!!sermver.valid(v)) {
                    return sermver.valid(v);
                } else {
                    return v;
                }
            }
        }, {
            type: 'list',
            name: 'projectTemplate',
            message: `请选择${title}模板`,
            choices: this.createTemplateChoice()
        });
        log.verbose(type);
        if (type === TYPE_PROJECT) {
            //4.获取项目的基本信息
            const project = await inquirer.prompt(projectPrompt);
            projectInfo = {
                ...projectInfo,
                type,
                ...project
            };
        } else if (type === TYPE_COMPONENT) {
            const descriptionPrompt = {
                type: 'input',
                name: 'componentDescription',
                default: '',
                message: '请输入组件描述信息',
                validate: function (v) {
                    const done = this.async();
                    setTimeout(function () {
                        if (!v) {
                            done('请输入组件描述信息');
                            return;
                        }
                        done(null, true);
                    }, 0);
                }
            };
            projectPrompt.push(descriptionPrompt);
            const component = await inquirer.prompt(projectPrompt);
            projectInfo = {
                ...projectInfo,
                type,
                ...component
            };

        }
        //生成className
        if (projectInfo.projectName) {
            projectInfo.name = projectInfo.projectName;
            projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '');
        }
        if (projectInfo.projectVersion) {
            projectInfo.version = projectInfo.projectVersion;
        }
        if (projectInfo.componentDescription) {
            projectInfo.description = projectInfo.componentDescription;
        }
        // return 基本信息
        return projectInfo;
    }

    isDirEmpty(localPath) {
        let fileList = fs.readdirSync(localPath);
        fileList = fileList.filter(file => (!file.startsWith('.') && ['node_modules'].indexOf(file) < 0));
        return !fileList || fileList.length <= 0;
    }

    createTemplateChoice() {
        return this.template.map(v => (
            {
                value: v.npmName,
                name: v.name
            }
        ));
    }

}

function init(argv) {
    return new InitCommand(argv);
}

module.exports = init;
