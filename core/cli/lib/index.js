'use strict'

module.exports = core

let  args,config;

const path = require('path')
const semver = require('semver')
const colors = require('colors/safe')
const pkg = require('../package.json')
const log = require('@yingzy-cli-dev/log')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const constant = require('./const')
const dotenv = require("dotenv")

function core() {
    try {
        checkPkgVersion()
        checkNodeVersion()
        checkRoot()
        checkUserHome()
        checkInputArgs()
        checkEnv()
    } catch (e) {
        log.error(e.message)
    }
}

function checkEnv() {
    //加载环境变量
    const dotenv = require('dotenv')
    const dotenvPath = path.resolve(userHome,'.env')
    if(pathExists(dotenvPath)){
        dotenv.config({
            path:dotenvPath
        })
    }
    // console.log('ddd',path.resolve(userHome,'.env'))
    const config = createDefaultConfig()
    log.verbose('环境变量',config)
}

function createDefaultConfig() {
    // 设置默认环境变量
    const cliConfig = {
        home:userHome,
    }
    if(process.env.CLI_HOME){
        cliConfig['cliHome'] = path.join(userHome,process.env.CLI_HOME)
    }else{
        cliConfig['cliHome'] = path.join(userHome,constant.DEFAULT_CLI_HOME)
    }
    return cliConfig
}

function checkInputArgs() {
    //获取参数，如debug
    const minimist = require('minimist')
    args = minimist(process.argv.slice(2))
    checkArgs()
}

function checkArgs() {
    //检查debug
    if(args.debug){
        process.env.LOG_LEVEL = 'verbose'
    }else{
        process.env.LOG_LEVEL = 'info'
    }
    //此处修改必须早于const log = require('@yingzy-cli-dev/log')
    //或者确定之后再次修改
    log.level = process.env.LOG_LEVEL
}

function checkUserHome() {
    // 检查用户主目录
    if (!userHome || !pathExists(userHome)) {
        throw new Error(colors.red('当前登录用户主目录不存在！'))
    }
}

function checkRoot() {
    //检查root账户和自动降级
    const rootCheck = require('root-check')
    rootCheck()
}

function checkPkgVersion() {
    // 获取脚手架版本号
    console.log(pkg.version)
    log.notice('cli', pkg.version)
}

function checkNodeVersion() {
    //获取当前node版本号
    console.log(process.version)
    const currentVersion = process.version
    const lowestVersion = constant.LOWEST_NODE_VERSION
    if (!semver.gte(currentVersion, lowestVersion)) {
        throw new Error(colors.red(`yingzy-cli 需要安装 v${lowestVersion}以上版本的 Node.js`))
    }
}

