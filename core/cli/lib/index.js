'use strict'

module.exports = core

const semver = require('semver')
const colors = require('colors/safe')
const pkg = require('../package.json')
const log = require('@yingzy-cli-dev/log')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const constant = require('./const')

function core() {
   try {
       checkPkgVersion()
       checkNodeVersion()
       checkRoot()
       checkUserHome()
   }catch (e) {
       log.error(e.message)
   }
}

function checkUserHome() {
    console.log(userHome)
    if(!userHome||!pathExists(userHome)){
        throw new Error(colors.red('当前登录用户主目录不存在！'))
    }
}

function checkRoot() {
    const rootCheck = require('root-check')
    rootCheck()
    console.log(process.geteuid())

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

