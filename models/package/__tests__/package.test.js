'use strict';

const Package = require('../lib');
const should = require('should');
const fs = require('fs');
const fse = require('fs-extra');

const TARGET_PATH = '/Users/mc/Documents/demo/lego/yingzy-cli-dev/commands/init';
const TARGET_PATH2 = '/Users/mc/.yingzy-cli-dev';
const STORE_DIR = '/Users/mc/.yingzy-cli-dev/node_modules';
const PACKAGE_NAME = '@yingzy-cli-dev/init';
const PACKAGE_NAME2 = '@yingzy-cli-dev/init';
const PACKAGE_NAME_CONVERT = '@yingzy-cli-dev_init';
const PACKAGE_VERSION = '1.0.0';
const PACKAGE_LATEST_VERSION = 'latest';

function createPackageWithoutTargetPath() {
    return createPackageInstance({haveTargetPath: false});
}

function createPackageInstance(options = {haveTargetPath: true}) {
    const packageVersion = options.latestVersion ? PACKAGE_LATEST_VERSION : PACKAGE_VERSION;
    const packageName = options.latestVersion ? PACKAGE_NAME2 : PACKAGE_NAME;
    const {haveTargetPath} = options;
    return haveTargetPath ? new Package({
        targetPath: TARGET_PATH,
        storeDir: STORE_DIR,
        packageName,
        packageVersion
    }) : new Package({
        storeDir: STORE_DIR,
        packageName,
        packageVersion
    });
}


describe('Package对象实例化', function () {
    it('options参数为空', () => {
        try {
            new Package();
        } catch (e) {
            e.message.should.equal('Package类的options参数不能为空！');
        }
    });
    it('option参数不为对象', () => {
        try {
            new Package(1);
        } catch (e) {
            e.message.should.equal('Package类的options必须为对象！');
        }
        try {
            new Package(function () {
            });
        } catch (e) {
            e.message.should.equal('Package类的options必须为对象！');
        }
    });
    it('带targetPath的实例化', function () {
        const packageInstance = createPackageInstance();
        packageInstance.should.have.property('targetPath', TARGET_PATH);
        packageInstance.should.have.property('storeDir', STORE_DIR);
        packageInstance.should.have.property('packageName', PACKAGE_NAME);
        packageInstance.should.have.property('packageVersion', PACKAGE_VERSION);
        packageInstance.should.have.property('packageFilePathPrefix', PACKAGE_NAME_CONVERT);
    });
    it('不带targetPath的实例化', function () {
        const packageInstance = createPackageWithoutTargetPath();
        packageInstance.should.have.property('targetPath', undefined);
        packageInstance.should.have.property('storeDir', STORE_DIR);
        packageInstance.should.have.property('packageName', PACKAGE_NAME);
        packageInstance.should.have.property('packageVersion', PACKAGE_VERSION);
        packageInstance.should.have.property('packageFilePathPrefix', PACKAGE_NAME_CONVERT);
    });
});

describe('Package prepare方法测试', function () {
    before(function () {
        if (fs.existsSync(STORE_DIR)) {
            fse.removeSync(STORE_DIR);
        }
    });
    it('storeDir不存在时，创建storeDir', async function () {
        fs.existsSync(STORE_DIR).should.be.false();
        const packageInstance = createPackageInstance();
        await packageInstance.prepare();
        fs.existsSync(STORE_DIR).should.be.true();
    });
    it('packageVersion为latest获取最新版本号', async function () {
        const packageInstance = createPackageInstance({latestVersion: true});
        console.log('packageInstance', packageInstance);

        await packageInstance.prepare();

        packageInstance.packageVersion.should.equal('1.0.10');
    });
});

