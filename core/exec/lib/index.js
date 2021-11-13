'use strict';

const Package = require('@yingzy-cli-dev/package');
const log = require('@yingzy-cli-dev/log');

const SETTINGS = {
    init: '@yingzy-cli-dev/init'
};

function exec() {
    const targetPath = process.env.CLI_TARGET_PATH;
    const homePath = process.env.CLI_HOME_PATH;
    log.verbose('targetPath', targetPath);
    log.verbose('homePath', homePath);

    const cmdObj = arguments[arguments.length - 1];
    console.log(cmdObj.opts().force);
    const cmdName = cmdObj.name();
    const packageName = SETTINGS[cmdName];
    const packageVersion = 'latest';

    const pkg = new Package({
        targetPath,
        packageName,
        packageVersion
    });
    console.log(pkg);
    console.log(process.env.CLI_TARGET_PATH);
}

module.exports = exec;
