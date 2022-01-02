'use strict';

module.exports = core;

const path = require('path');
const semver = require('semver');
const colors = require('colors/safe');
const commander = require('commander');
const pathExists = require('path-exists').sync;
const log = require('@yingzy-cli-dev/log');
const exec = require('@yingzy-cli-dev/exec');
const os = require('os');

const constant = require('./const');
const pkg = require('../package.json');
const userHome = os.homedir();

const program = new commander.Command();

async function core() {
    try {
        await prepare();
        registerCommand();
    } catch (e) {
        log.error(e.message);
        if (program.opts().debug) {
            console.log(e);
        }
    }
}

function registerCommand() {
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
        .option('-tp, --targetPath <targetPath>', '是否指定本地文件调试', '');

    program
        .command('init [projectName]')
        .option('-f, --force', '是否强制初始化')
        .action(exec);

    program
        .command('publish')
        .option('--refreshServer', '强制更新远程Git仓库')
        .action(exec);

    // 开启debug模式
    program.on('option:debug', function () {
        if (program.opts().debug) {
            process.env.LOG_LEVEL = 'verbose';
        } else {
            process.env.LOG_LEVEL = 'info';
        }
        log.level = process.env.LOG_LEVEL;
    });

    //指定targetPath
    program.on('option:targetPath', function () {
        // 会优先命令init执行
        process.env.CLI_TARGET_PATH = program.opts().targetPath;
    });

    //未知命令监听
    program.on('command:*', function (obj) {
        const availableCommands = program.commands.map(cmd => cmd.name());
        console.log(colors.red('未知的命令：' + obj[0]));
        if (availableCommands.length > 0) {
            console.log(colors.green('可用命令1：' + availableCommands.join(',')));
        }
    });
    //program.args
    const commandName = program.commands.map(cmd => cmd.name());
    if (commandName && commandName.length < 1) {
        // node yingzy-cli [command].未知命令
        program.outputHelp();
        console.log();
    }
    program.parse(process.argv);
}

async function prepare() {
    checkPkgVersion();
    checkRoot();
    checkUserHome();
    // checkInputArgs();
    checkEnv();
    await checkGlobalUpdate();
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
    // console.log(pathExists(dotenvPath), dotenvPath);
    if (pathExists(dotenvPath)) {
        dotenv.config({
            path: dotenvPath
        });
    }
    createDefaultConfig();
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
    log.notice('cli', pkg.version);
}



