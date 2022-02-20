# `core`

> TODO: 采用自动化、标准化，提升前端研发效能；

## Usage

### @yingzy-cli-dev/core

```
    npm i -g @yingzy-cli-dev/core
```

```
Usage: yingzy <command> [options]

Options:
  -V, --version                   output the version number
  -d, --debug                     是否开启调试模式 (default: false)
  -tp, --targetPath <targetPath>  是否指定本地文件调试 (default: "")
  -h, --help                      display help for command

Commands:
  init [options] [projectName]
  publish [options]
  help [command]                  display help for command

```

#### 初始化项目

```
    yingzy init <projectName>
```

#### 版本发布

通过自动化流程完成git提交，通过服务端构建，将构建后的文件直接上传到oss部署并生成访问链接；history模式下可选择上传到nginx服务器部署

```
    yingzy publish
```
