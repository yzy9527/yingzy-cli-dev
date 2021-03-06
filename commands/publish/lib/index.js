'use strict';

const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const Command = require('@yingzy-cli-dev/command');
const log = require('@yingzy-cli-dev/log');
const Git = require('@yingzy-cli-dev/git');

class PublishCommand extends Command {
    init() {
        log.verbose('publish', this._argv);
        this.options = {
            refreshServer: this._cmd.opts().refreshServer,
            refreshToken: this._cmd.opts().refreshToken,
            refreshOwner: this._cmd.opts().refreshOwner,
            buildCmd: this._cmd.opts().buildCmd,
            prod: this._cmd.opts().prod,
            sshUser: this._cmd.opts().sshUser,
            sshIp: this._cmd.opts().sshIp,
            sshPath: this._cmd.opts().sshPath,
            refreshOssKey: this._cmd.opts().refreshOssKey
        };
    }

    async exec() {
        try {
            const startTime = new Date().getTime();
            //1. 初始化检查
            this.prepare();
            // 2. git flow自动化
            const git = new Git(this.projectInfo, this.options);
            await git.prepare();//提交前准备和代码仓库初始化
            await git.commit();
            // 3. 云构建和云发布
            await git.publish();
            const endTIme = new Date().getTime();
            log.info('本次发布耗时：', Math.floor((endTIme - startTime) / 1000) + '秒');
        } catch (e) {
            log.error(e.message);
            if (process.env.LOG_LEVEL === 'verbose') {
                console.log(e);
            }
        }
    }

    prepare() {
        // 1.确定是否为npm项目
        const projectPath = process.cwd();
        const pkgPath = path.resolve(projectPath, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            throw new Error('package.json不存在');
        }
        //2.确认package.json是否包含name,version,build命令
        const pkg = fse.readJsonSync(pkgPath);
        const {name, version, scripts} = pkg;
        log.verbose(name, version, scripts);
        if (!name || !version || !scripts.build) {
            throw new Error('package.json信息不全,请检查name、version和scripts（需包含build命令）是否存在！');
        }
        this.projectInfo = {
            name, version, dir: projectPath
        };
    }

}


function publish(argv) {
    return new PublishCommand(argv);
}

module.exports = publish;
