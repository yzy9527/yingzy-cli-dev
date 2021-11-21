'use strict';

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
            require(rootFile).call(null, Array.from(arguments));
        } catch (e) {
            log.error(e.message);
        }
    }
}

module.exports = exec;
