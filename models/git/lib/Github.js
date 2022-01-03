const GitServer = require('./GitServer');
const GithubRequest = require('./GithubRequest');

class Github extends GitServer {
    constructor() {
        super('github');
        this.request = null;
    }

    setToken(token) {
        super.setToken(token);
        this.request = new GithubRequest(token);
    }

    getUser() {
        return this.request.get('/user');
    }

    getOrg(username) {
        return this.request.get(`/users/orgs`, {
            page: 1,
            per_page: 100
        });
    }

    getTokenUrl() {
        return 'https://github.com/settings/keys';
    }

    getTokenHelpUrl() {
        return 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account';
    }
}

module.exports = Github;
