const GitServer = require('./GitServer');

class Github extends GitServer {
    constructor() {
        super('github');
    }

    setToken() {
        return '';
    }

    getSSHKeysUrl() {
        return 'https://github.com/settings/keys';
    }

    getTokenHelpUrl() {
        return 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account';
    }
}

module.exports = Github;
