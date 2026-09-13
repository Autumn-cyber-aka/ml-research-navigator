# 第6课：网页模板和你的第一次修改

[回目录](../LEARNING_GUIDE.md) · [上一课](03_PYTHON_AND_REQUESTS.md) · [下一课](05_LOGIN_AND_OWNERSHIP.md)

**今天的目标：** 认识网页结构，亲手修改一句话，不碰数据规则。

## 1. HTML、CSS、Jinja 是三种不同工具

- HTML 像文章骨架：这里是标题，那里是段落，再下面是按钮。
- CSS 管样子：颜色、大小、间距、手机上怎么排列。
- Jinja 是模板工具：把“这里放论文标题”换成数据库查到的具体标题。

看一个普通 HTML：

```html
<h1>论文库</h1>
<p>这里可以寻找想读的论文。</p>
```

`<h1>` 是大标题开始，`</h1>` 是结束；中间是文字。`<p>` 是段落。尖括号里的这些记号叫标签。

看一个模板：

```html
<h1>{{ paper.title }}</h1>
```

`{{ ... }}` 表示在这里放一个值。paper.title 是这篇论文的标题。Jinja 在服务器上填好，浏览器看到的通常已经是具体文字。

## 2. 多篇论文为什么只写一段模板？

在 papers.html 中能看到类似：

```jinja
{% for p in papers %}
    {{ paper_row(p) }}
{% endfor %}
```

`{% ... %}` 是模板中的控制指令，不直接显示成文字。for 表示每篇都做一次。

`paper_row` 在 [`macros.html`](../../navigator/templates/macros.html) 中定义。它是一个可重复使用的网页小组件，叫宏。每次传入一篇论文，就画出一行。

这和“盖同一种格式的印章，再填不同内容”很像，避免复制12段几乎相同的 HTML。

## 3. 每页相同的侧栏放在哪？

[`base.html`](../../navigator/templates/base.html) 保存共同的侧栏、页头和页脚。其他页面用 extends 表示沿用这个底板，再往 block content 里放自己的内容。

先不研究所有模板指令。现在只要知道：页面公共部分在 base.html，论文内容在 papers.html 与 macros.html，单篇详情在 paper.html。

## 4. 为什么评论里的尖括号不会变成程序？

如果有人写 `<script>...</script>`，我们希望展示这段文字，而不是让它在读者浏览器里执行。

Jinja 的自动转义会把特殊字符转换成安全的文字表示。这叫**转义**。不要为了“让 HTML 生效”随便给用户评论加 `|safe`，那会跳过保护。

## 5. 亲手改一句话

这是修改文件的练习，按顺序做：

1. 用编辑器打开真正项目目录。
2. 打开 [`navigator/templates/paper.html`](../../navigator/templates/paper.html)。
3. 用编辑器搜索 `Your next step`。
4. 只把这几个文字改成 `我的下一步`。不要改周围的 `<h2>` 和 `</h2>`。
5. 保存文件（macOS 常用 Command+S）。

你改的是详情页侧边栏标题。论文库首页不会出现这句话，所以要打开论文 #1 的详情才能检查。

## 6. 如何让修改显示出来？

**如果使用 Docker：** 保存以后，在项目根目录执行：

```bash
docker compose up --build -d app
```

我们的 Docker 配置把代码装进镜像，所以需要重建 app，而不是只刷新页面。数据库数据保留。

**如果使用已经配置好的原生 Python/MySQL：** 可另开一个学习用服务器，避开当前5055预览：

```bash
source .venv/bin/activate
gunicorn --reload --bind 127.0.0.1:5056 'navigator:create_app()'
```

这条命令会占着当前终端并显示日志，是正常的。浏览器打开 `http://127.0.0.1:5056/papers/1`。`--reload` 会在检测到应用代码改变时重新加载；模板修改的查看以实际刷新结果为准，必要时在这个终端按 Control+C 停止，再执行同一条命令。它仍然需要本地 MySQL 正在运行。

**预期结果：** 详情侧栏出现“我的下一步”，其他功能照常。

## 7. 修改错了怎么办？

先别改其他文件。在项目根目录运行：

```bash
git diff -- navigator/templates/paper.html
```

git diff 显示你改了什么：减号是原来的内容，加号是新的内容，不是 Python 运算。

你可以手动把文字改回 `Your next step` 并保存。这个练习不用推送 GitHub。不要使用“清空整个文件夹”这样的办法修复一句文字。

## 小任务

你改了标题，却只刷新论文库首页，看不到变化。最先应该检查什么？

<details><summary>参考答案</summary>

确认打开的是单篇论文详情；确认文件已保存、修改的是实际运行目录；Docker 路线确认重建了 app。不要先猜数据库坏了，因为这次只改了模板文字。

</details>

**过关标准：** 你能解释自己改的是页面文字，没有修改数据库中的论文标题。
