#! /usr/bin/env node

const importLocal = require('import-local')

if(importLocal(__filename)){
    require('npmlog').info('cli','正在使用yingzy-cli本地版本')

}else {
    // require('npmlog').info('__filename',__filename)
    require('../lib')(process.argv.slice(2))
}
