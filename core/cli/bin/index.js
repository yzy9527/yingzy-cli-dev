#! /usr/bin/env node

const importLocal = require('import-local')

if(importLocal(__filename)){
    console.log('__filename',__filename)
}else {
    require('npmlog').info('cli','正在使用yingzy-cli本地版本',__filename)

    require('../lib/core')(process.argv.slice(2))
}
