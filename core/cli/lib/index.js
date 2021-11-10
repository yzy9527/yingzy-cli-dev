'use strict';

module.exports = core;

const path = require('path');
const semver = require('semver');
const colors = require('colors/safe');
const commander = require('commander');
const pkg = require('../package.json');
const log = require('@yingzy-cli-dev/log');
const userHome = require('user-home');
const pathExists = require('path-exists').sync;
const constant = require('./const');

let args;

const program = new commander.Command();


async function core() {
    try {
        checkPkgVersion();
        checkNodeVersion();
        checkRoot();
        checkUserHome();
        checkInputArgs();
        checkEnv();
        await checkGlobalUpdate();
        registerCommand();
    } catch (e) {
        log.error(e.message);
    }
}

function registerCommand() {
    program
        .name(Object.keys[pkg.bin[0]])
        .usage('<command> [options]')
        .version(pkg.version);
    program.parse(process.argv);
}

async function checkGlobalUpdate() {
    //1. 获取当前版本号和模块名
    const currentVersion = pkg.version;
    const npmName = pkg.name;
    //2. 调用npm api,获取所有版本号
    const {getNpmSemverVersion} = require('@yingzy-cli-dev/get-npm-info');
    //3.对比版本号，过滤版本号
    const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
    if (lastVersion && semver.gt(lastVersion, currentVersion)) {
        log.warn('更新提示', colors.yellow(`请手动更新${npmName}，当前版本${currentVersion}，最新版本${lastVersion}
        更新命令：npm install -g ${npmName}`));
    }
}

function checkEnv() {
    //加载环境变量
    const dotenv = require('dotenv');
    const dotenvPath = path.resolve(userHome, '.env');
    console.log('dd', pathExists(dotenvPath), dotenvPath);
    if (pathExists(dotenvPath)) {
        dotenv.config({
            path: dotenvPath
        });
    }
    createDefaultConfig();
    log.verbose('环境变量', process.env.CLI_HOME_PATH);
}

function createDefaultConfig() {
    // 设置默认环境变量
    const cliConfig = {
        home: userHome
    };
    if (process.env.CLI_HOME) {
        cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME);
    } else {
        cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME);
    }
    process.env.CLI_HOME_PATH = cliConfig.cliHome;
}

function checkInputArgs() {
    //获取参数，如debug
    const minimist = require('minimist');
    args = minimist(process.argv.slice(2));
    checkArgs();
}

function checkArgs() {
    //检查debug
    if (args.debug) {
        process.env.LOG_LEVEL = 'verbose';
    } else {
        process.env.LOG_LEVEL = 'info';
    }
    //此处修改必须早于const log = require('@yingzy-cli-dev/log')
    //或者确定之后再次修改
    log.level = process.env.LOG_LEVEL;
}

function checkUserHome() {
    // 检查用户主目录
    if (!userHome || !pathExists(userHome)) {
        throw new Error(colors.red('当前登录用户主目录不存在！'));
    }
}

function checkRoot() {
    //检查root账户和自动降级
    const rootCheck = require('root-check');
    rootCheck();
}

function checkPkgVersion() {
    // 获取脚手架版本号
    console.log(pkg.version);
    log.notice('cli', pkg.version);
}

function checkNodeVersion() {
    //获取当前node版本号
    console.log(process.version);
    const currentVersion = process.version;
    const lowestVersion = constant.LOWEST_NODE_VERSION;
    if (!semver.gte(currentVersion, lowestVersion)) {
        throw new Error(colors.red(`yingzy-cli 需要安装 v${lowestVersion}以上版本的 Node.js`));
    }
}

