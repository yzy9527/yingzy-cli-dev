const GitServer = require('./GitServer');
const GiteeRequest = require('./GiteeRequest');

class Gitee extends GitServer {
    constructor() {
        super('gitee');
        this.request = null;
    }

    setToken(token) {
        super.setToken(token);
        this.request = new GiteeRequest(token);
    }

    getUser() {
        return this.request.get('/user');
    }

    getOrg(username) {
        return this.request.get(`/users/${username}/orgs`, {
            page: 1,
            per_page: 100
        });
    }

    getRepo(login, name) {
        ///repos/{owner}/{repo}
        return this.request.get(`/repos/${login}/${name}`).then(res => {
            if (res.state !== 200) {
                return null;
            }
            return res;
        });

    }

    getTokenUrl() {
        return 'https://gitee.com/personal_access_tokens';
    }

    getTokenHelpUrl() {
        return 'https://gitee.com/help/articles/4191';
    }
}

module.exports = Gitee;
