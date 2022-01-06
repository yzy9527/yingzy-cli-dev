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
        return this.request.get(`/user/orgs`, {
            page: 1,
            per_page: 100
        });
    }

    getRepo(owner, repo) {
        return this.request.get(`/repos/${owner}/${repo}`, {
            Accept: 'application/vnd.github.v3+json'
        }).then(response => {
            if (response.status !== 404) {
                return response;
            } else {
                return null;
            }
            // return this.handleResponse(response)
        });
    }

    createRepo(name) {
        return this.request.post('/user/repos', {
            name
        }, {
            Accept: 'application/vnd.github.v3+json'
        });
    }

    createOrgRepo(name, login) {
        return this.request.post(`/orgs/${login}/repos`, {
            name
        }, {
            Accept: 'application/vnd.github.v3+json'
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
