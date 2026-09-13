# 第16课：让别人也能打开网站

当前公开入口已迁到 [GitHub Pages](https://autumn-cyber-aka.github.io/ml-research-navigator/)，全部功能仍使用原云端后端。请结合[第18课](12_GITHUB_PAGES.md)阅读；下面的 Sites 部署说明仍适用于后端。

**当前采用 Sites 部署路线，沿用 PaperRank 使用的平台。** 平台帮我们运行线上程序并提供 D1，浏览目录无需登录，保存个人数据时点 Sign in with ChatGPT。你不需要继续注册 Render 和 Aiven。

**[点击打开已经上线的网站](https://ml-research-navigator.lyujianchen182.chatgpt.site)。** 公开状态和验证详情见 [部署记录](../DEPLOYMENT.md)，操作步骤见[第17课](11_TWO_EDITIONS.md)。原来的 Flask + MySQL 代码完整保留在仓库里。

下面保留的是“如果未来想把原版 Flask + MySQL 本身搬到云端”的备用路线，不是当前网站上线的必做步骤。

## 先认识三间屋子

- **GitHub**：放说明书和代码的书架。别人能看代码，不等于程序正在工作。
- **Render**：一直帮你运行 Python 网页程序的电脑。它给你 HTTPS 网址。
- **Aiven MySQL**：专门保存登记册的数据库。网站电脑重新启动，登记册仍在这里。

你自己的 `127.0.0.1:5055` 只属于你这台电脑。公开地址通常长得像 `https://某个名字.onrender.com`。只有平台真的创建服务、连接数据库并验证成功，才算部署完成。不能把猜出来的域名当成可用网址。

Render + Aiven 方案未创建资源，已改为使用 Sites 线上版。这里的环境变量只适用于备用的原版托管方案。

## 为什么选这两家

这个项目使用真正的 MySQL。Render 免费网页服务不提供持久磁盘，因此不能把数据库文件放在网页电脑上。Aiven 有独立免费 MySQL 方案。免费网页服务会休眠，首次打开可能要等一会儿；它适合学习演示，不保证生产可用性。平台套餐会变化，创建前检查当前页面的价格，只选明确标为 Free 的选项。

官方说明：[Render 免费服务](https://render.com/docs/free)、[Aiven 免费 MySQL](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)。

## 第一步：准备钥匙，不把钥匙写进说明书

在 Render 和 Aiven 登录自己的账号。注册条款、验证码由账号主人处理。数据库密码和 `SECRET_KEY` 是钥匙：填进平台的私密环境变量，不能上传 GitHub，也不要发在聊天里。

“环境变量”就是电脑启动程序前交给它的小纸条。程序在 `navigator/__init__.py` 读取这些纸条。代码只写“去拿密码”，不写真实密码。

## 第二步：在 Aiven 创建空数据库

选择免费的 MySQL 服务，等状态可以使用。创建专用数据库 `navigator`，不要连到已有重要数据的库。保存服务显示的主机、端口、用户、密码和 CA 证书。

“主机和端口”像小区地址和门牌。“CA证书”帮助程序确认对面真的是该数据库，并建立加密连接。本项目设置 `MYSQL_SSL_CA` 后会检查证书和主机名；不通过就连接失败，不会悄悄退回明文。

由数据库管理员用新服务的连接配置运行一次 `flask --app navigator init-db` 和 `flask --app navigator seed`。命令见第0课和 README；这次的配置指向**新云数据库**，并设置 CA 文件路径，去掉本机 `MYSQL_UNIX_SOCKET`。先核对目标数据库再执行。

初始化只接受空库，样例导入只加入虚构论文和作者，不复制本地用户、密码、评论或书单。运行时账号只需要 SELECT、INSERT、UPDATE、DELETE；建表和迁移使用单独的管理账号。若套餐限制独立账号，记录这个限制并在开放注册前完成权限评估。

## 第三步：在 Render 运行代码

仓库里的 [`render.yaml`](../../render.yaml) 是一张“怎么开机”的清单，可以用 Render Blueprint 导入仓库。也可以手动创建 Web Service：

|设置|填什么|为什么|
|---|---|---|
|代码仓库|Autumn-cyber-aka/ml-research-navigator|下载我们的代码|
|运行环境|Python|代码用这个语言|
|套餐|Free|不创建付费资源|
|构建命令|`pip install -r requirements.txt`|安装代码需要的工具|
|启动命令|`gunicorn --bind 0.0.0.0:$PORT --workers 2 'navigator:create_app()'`|接待网页请求|
|健康检查|`/health`|检查网页和数据库是否可用|

`$PORT` 是 Render 分配的门牌，不能固定用你本机的5055。`gunicorn` 是接待请求的服务程序，`workers 2` 表示两个接待工人。

在环境变量中填 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE=navigator`。用平台生成随机 `SECRET_KEY`，设置 `COOKIE_SECURE=1`、`TRUST_PROXY=1`。

上传数据库 CA 为 Render Secret File `mysql-ca.pem`，对应路径 `/etc/secrets/mysql-ca.pem`。将 `MYSQL_SSL_CA` 设为这个路径。CA证书不是数据库密码，但用 Secret File 管理能让部署配置保持集中。不要把本机 `.env` 整个上传，里面的 socket 和 localhost 设置在云端不能用。

`TRUST_PROXY=1` 表示前面有一个可信的平台接待台，它告诉 Flask 原请求来自 HTTPS。仅用于这种托管环境，本地保持0。程序不信任别人随便填的转发主机名。

## 第四步：不是看到绿色按钮就结束

部署成功后，从平台复制实际分配的 HTTPS 网址，做这些检查：

1. 打开目录、搜索、作者页、合作者图；`/health` 应返回成功。
2. 注册专用演示账号，登录，创建私人书单。
3. 主动公开一份不含私人信息的书单，用未登录窗口确认能看；再取消公开，旧链接应失效。
4. 用第二个测试账号验证点赞不会重复，排行榜能根据真实评分出现数据。
5. 让服务重新部署一次，确认数据仍在。不要用删除数据库来“测试重启”。

测试是测试数据，不把这些账号写成真实用户增长。不要公开默认密码。如果遇到问题，只分享错误类型和脱敏日志。

## 常见卡点

|看到什么|先检查什么|
|---|---|
|第一次很慢|免费网页服务可能刚从休眠醒来|
|数据库503|主机、端口、密码、CA、数据库状态和允许连接的网络|
|证书错误|CA是否来自这个服务，主机名是否和服务提供的一致；不要关闭校验|
|提交表单400|HTTPS、COOKIE_SECURE、TRUST_PROXY是否配套，刷新后重新登录|
|表不存在|是否在正确的新数据库初始化或迁移过|
|排行榜是空的|是否至少有默认要求的2位用户评分|

小题：把代码推上 GitHub 后关掉自己的电脑，为什么不一定有网页可访问？答案：GitHub保存代码，并没有自动运行我们的 Flask + MySQL；需要托管电脑运行它们。

学完这课，你应能画出“浏览器 → Render 上的 Flask → Aiven MySQL → 返回网页”，并解释代码、运行中的程序和数据库为什么是三件不同的东西。
