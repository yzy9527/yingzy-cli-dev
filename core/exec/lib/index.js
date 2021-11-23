'use strict';

const cp = require('child_process');
const Package = require('@yingzy-cli-dev/package');
const log = require('@yingzy-cli-dev/log');
const path = require('path');

const SETTINGS = {
    init: 'yingzy-test'
};

const CACHE_DIR = 'dependencies';

async function exec() {
    let targetPath = process.env.CLI_TARGET_PATH;
    const homePath = process.env.CLI_HOME_PATH;
    let storeDir = '';
    let pkg;
    log.verbose('targetPath', targetPath);
    log.verbose('homePath', homePath);

    const cmdObj = arguments[arguments.length - 1];
    const cmdName = cmdObj.name();
    const packageName = SETTINGS[cmdName];
    const packageVersion = 'latest';

    if (!targetPath) {
        // 生成缓存路径
        targetPath = path.resolve(homePath, CACHE_DIR);
        storeDir = path.resolve(targetPath, 'node_modules');
        log.verbose(targetPath);
        log.verbose(storeDir);

        pkg = new Package({
            storeDir,
            targetPath,
            packageName,
            packageVersion
        });
        if (await pkg.exists()) {
            //更新
            console.log('更新package');
            await pkg.update();
        } else {
            //安装
            await pkg.install();
        }
    } else {
        pkg = new Package({
            targetPath,
            packageName,
            packageVersion
        });
    }
    const rootFile = pkg.getRootFilePath();
    if (rootFile) {
        try {
            //在当前进程中调用
            // require(rootFile).call(null, Array.from(arguments));
            const args = Array.from(arguments);
            const cmd = args[args.length - 1];
            const o = Object.create(null);
            o._opts = cmd.opts(); //SON.stringify不能处理函数
            Object.keys(cmd).forEach(key => {
                if (cmd.hasOwnProperty(key) && (!key.startsWith('_')) &&
                    key !== 'parent') {
                    o[key] = cmd[key];
                }
            });
            args[args.length - 1] = o;
            const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`;
            const child = spawn('node', ['-e', code], {
                cwd: process.cwd(),
                stdio: 'inherit'
            });
            child.on('error', e => {
                log.error(e.message);
                process.exit(1);//异常退出,e为正常退出
            });
            child.on('exit', e => {
                log.verbose('命令执行成功:' + e);
            });
        } catch (e) {
            log.error(e.message);
        }
    }
}

function spawn(command, args, options) {
    // win cp.spawn('cmd',['/c','node','-e',code]) // /c表示静默执行
    const win32 = process.platform === 'win32';

    const cmd = win32 ? 'cmd' : command;
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args;
    return cp.spawn(cmd, cmdArgs, options || {});
}

module.exports = exec;
