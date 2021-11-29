'use strict';

const fs = require('fs');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const sermver = require('semver');
const Command = require('@yingzy-cli-dev/command');
const log = require('@yingzy-cli-dev/log');

const TYPE_PROJECT = 'project';
const TYPE_COMPONENT = 'component';

class InitCommand extends Command {
    init() {
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.opts().force;
        log.verbose('projectName', this.projectName);
        log.verbose('force', this.force);
    }

    async exec() {
        try {
            const ret = await this.prepare();
        } catch (e) {
            log.error(e.message);
        }
    }

    async prepare() {
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
        //3.选择性创建项目或文件
        const projectInfo = {};
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
        log.verbose(type);
        if (type === TYPE_PROJECT) {
            //4.获取项目的基本信息
            const o = await inquirer.prompt([{
                type: 'input',
                name: 'projectName',
                default: '',
                message: '请输入项目名称',
                validate: function (v) {
                    const done = this.async();
                    setTimeout(function () {
                        if (!/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9]*)/
                            .test(v)) {
                            done('请输入合法的项目名称');
                            return;
                        }
                        done(null, true);
                    }, 0);
                },
                filter: function (v) {
                    return v;
                }
            }, {
                type: 'input',
                name: 'projectVersion',
                default: '',
                message: '请输入项目版本号',
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
            }]);
            console.log(o);
        } else if (type === TYPE_COMPONENT) {

        }
        // return 基本信息
        return projectInfo;
    }

    isDirEmpty(localPath) {
        let fileList = fs.readdirSync(localPath);
        fileList = fileList.filter(file => (!file.startsWith('.') && ['node_modules'].indexOf(file) < 0));
        return !fileList || fileList.length <= 0;
    }
}

function init(argv) {
    return new InitCommand(argv);
}

module.exports = init;
