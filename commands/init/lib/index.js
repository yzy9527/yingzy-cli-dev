'use strict';

const fs = require('fs');
const inquirer = require('inquirer');
const fse = require('fs-extra');
const sermver = require('semver');
const Command = require('@yingzy-cli-dev/command');
const log = require('@yingzy-cli-dev/log');

const getProjectTemplate = require('./getProjectTemplate');

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
            const projectInfo = await this.prepare();
            if (projectInfo) {
                log.verbose('projectInfo', JSON.stringify(projectInfo));
                this.projectInfo = projectInfo;
                //下载模板
                this.downloadTemplate();
                // 安装模板
            }
        } catch (e) {
            log.error(e.message);
        }
    }

    downloadTemplate() {
        //1.通过项目模板api获取项目模板信息
        //1.1通过egg.js搭建一套后端系统
        //1.2通过npm存储模板
        //1.3将项目模板信息存到mongodb数据库中
        //1.4通过egg.js获取到mongodb中的数据并且通过api返回
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
        //3.选择性创建项目或文件
        let projectInfo = {};
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
            const project = await inquirer.prompt([{
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
                default: '1.0.0',
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
            }, {
                type: 'list',
                name: 'projectTemplate',
                message: '请选择项目模板',
                choices: this.createTemplateChoice()
            }
            ]);
            projectInfo = {
                type,
                ...project
            };
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
