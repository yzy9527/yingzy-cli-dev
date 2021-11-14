'use strict';

const path = require('path');
const pkgDir = require('pkg-dir').sync;
const npminstall = require('npminstall');
const {isObject} = require('@yingzy-cli-dev/utils');
const formatPath = require('@yingzy-cli-dev/format-path');
const {getDefaultRegistry} = require('@yingzy-cli-dev/get-npm-info');

class Package {
    constructor(options) {
        if (!options) {
            throw new Error('Package类的options参数不能为空！');
        }
        if (!isObject(options)) {
            throw new Error('Package类的options必须为对象！');
        }
        // package的路径
        this.targetPath = options.targetPath;
        // 缓存package的路径
        this.storeDir = options.storeDir;
        // package的name
        this.packageName = options.packageName;
        // package的版本
        this.packageVersion = options.packageVersion;

    }

    //判断当前Package是否存在
    exists() {

    }

    // 安装Package
    install() {
        return npminstall({
            root: this.targetPath,
            storeDir: this.storeDir,
            registry: getDefaultRegistry(),
            pkgs: [{
                name: this.packageName,
                version: this.packageVersion
            }]
        });
    }

    // 更新Package
    update() {
    }

// 获取入口文件的路径
    getRootFilePath() {
        // 1.获取package.json的目录
        const dir = pkgDir(this.targetPath);
        if (dir) {
            // 2.读取package.json
            const pkgFile = require(path.resolve(dir, 'package.json'));
            // 3. 寻找main/lib
            if (pkgFile && (pkgFile.main)) {
                // 4.路径的兼容（macOS/windows）
                return formatPath(path.resolve(dir, pkgFile.main));
            }
        }
        return null;
    }
}

module.exports = Package;
