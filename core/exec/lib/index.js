'use strict';

const Package = require('@yingzy-cli-dev/package');
const log = require('@yingzy-cli-dev/log');
const path = require('path');

const SETTINGS = {
    init: 'yingzy-cli-dev/init'
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
    console.log(cmdObj.opts().force);
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
        if (pkg.exists()) {
            //更新
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
        require(rootFile).apply(null, arguments);
    }
}

module.exports = exec;
