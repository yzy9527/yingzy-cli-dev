'use strict'

const log = require('npmlog')
log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info' //判断debug定制


log.heading = 'yingzy' //修改前缀
log.addLevel('success', 2000, {fg: 'green', bold: true}) //添加自定义

module.exports = log

