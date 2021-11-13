'use strict';

function init(projectName, options, cmdObj) {
    console.log('init', projectName, options, process.env.CLI_TARGET_PATH);
}

module.exports = init;
