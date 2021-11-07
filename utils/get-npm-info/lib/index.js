'use strict'

const axios = require('axios')
const urlJoin = require('url-join')
const semver = require('semver')

function getNpmInfo(npmName, registry) {
    if (!npmName) {
        return null
    }
    const registryUrl = registry || getDefaultRegistry()
    const npmInfoUrl = urlJoin(registryUrl, npmName)
    return axios.get(npmInfoUrl).then(response => {
        if (response.status === 200) {
            return response.data
        }
        return null
    }).catch(err => {
        return Promise.reject(err)
    })
}

function getDefaultRegistry(isOriginal = false) {
    return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobao.org'
}

async function getNpmVersion(npmName, registry) {
    const data = await getNpmInfo(npmName, registry)
    if (data) {
        return Object.keys(data.versions)
    } else {
        return []
    }
}

function getSemverVersions(baseVersion, versions) {
    versions = versions
        .filter(version => semver.satisfies(version, `^${baseVersion}`))
        .sort((a, b) => {
        //倒序，b>a,b在前,防止npm返回的版本号顺序错误
        return semver.gt(b, a)
    })
    return versions
}

async function getNpmSemverVersion(baseVersion,npmName, registry) {
    const versions = await getNpmVersion(npmName,registry)
    const newVersions = getSemverVersions(baseVersion,versions)
    if(newVersions&&newVersions.length>0){
        return newVersions[0]
    }
}

module.exports = {
    getNpmInfo,
    getNpmVersion,
    getNpmSemverVersion
}


