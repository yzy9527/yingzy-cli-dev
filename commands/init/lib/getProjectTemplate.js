const request = require('@yingzy-cli-dev/request');

module.exports = function () {
    return request({
        url: '/project/template'
    });
};
