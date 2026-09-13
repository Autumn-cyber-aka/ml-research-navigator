# 第1课：把它当成一家论文图书馆

[回目录](../LEARNING_GUIDE.md) · [上一课](00_START_HERE.md) · [下一课](02_TABLES_AND_SQL.md)

**今天的目标：** 不看代码，先完成一次真实使用流程。

## 1. 论文是什么？

可以先把论文理解为“研究者写的一篇较长的研究文章”。我们的软件不负责替你做研究，它帮你找到文章、分组、记进度和交流想法。

所有样例都是虚构的，例如 `Tiny Forest Classifiers`。它们用来学习软件和数据库，不是作者真的发表过的成果。

## 2. 页面英文对照表

|页面文字|中文|可以做什么|
|---|---|---|
|Paper library|论文库|找论文|
|Authors|作者|看某位作者关联的论文|
|Reading progress|阅读进度|看想读、在读、已读|
|Reading lists|阅读列表|给论文分组|
|Sign in / Sign out|登录 / 退出|进入或离开个人账户|
|Create account|注册账户|创建自己的身份|
|Review|评价|写看法，给1—5分|
|Discussion / Reply|讨论 / 回复|发问题，与别人交流|

## 3. 先找一本“书”

1. 打开 Paper library。
2. 在 Search the library 输入 `Tiny`。
3. 点击 Search papers。
4. 应该看到 `Tiny Forest Classifiers`。
5. 点标题进入详情。详情会显示论文编号 `Paper #1`、年份、作者和 Abstract（摘要）。摘要可以理解为内容简介。
6. 点 `Sample Researcher A`，查看这位虚构作者的论文。

现在你完成的是“读取”：只是查看资料，没有创建自己的记录。

## 4. 创建自己的读书身份

点 Sign in，再点 Create an account，填写名字、邮箱和12—128字符的密码。邮箱目前不会收到验证邮件；这是本地演示系统。

为了练习，可以使用 `reader-a@example.test` 这样的测试邮箱，密码自行设置且不要用真实账号密码。记住自己的密码，项目目前没有“忘记密码”功能。

成功后应该能看到你的名字和 Sign out。名字是展示用的，数据库还会给账户分配一个内部编号。

## 5. 给论文分组

1. 打开 Reading lists。
2. 在 Name 填 `我的第一份阅读清单`，Description 可以留空。
3. 点击 Create reading list。
4. 打开论文 #1 的详情，在 Reading list 下拉框中选择刚才的列表。
5. 点 Add to list。
6. 回到列表，应该能看到论文 #1。

“列表”像一个书单，不是把论文原件搬走。论文可以同时出现在多个列表里。

## 6. 保存阅读进度

回到论文 #1，找到 Reading progress：

- Want to read：想读。
- Reading：正在读。
- Finished：已经读完。代码里这个状态写成 `read`。

选 Reading，点 Save progress，再打开左侧 Reading progress，应该能看到这篇论文。

**想一想：** 从清单里移除论文，应该把“在读”也删掉吗？本项目的规则是不会。清单回答“分在哪组”，进度回答“读到哪了”，是两件事。

## 7. 写评价和讨论

在论文详情页找到 Write a review：选分数、写文字、点击 Publish review。一个用户对同一篇论文只能有一条评价，之后可以编辑或删除。

再展开 Start a discussion，输入标题和问题。发布后进入帖子，写一条回复。这里回复只有一层，不需要先学复杂的楼中楼。

评价和讨论是公开内容；阅读清单和阅读进度属于你的私人空间。

## 小任务

完成：搜索论文1 → 加入自己的列表 → 标为在读 → 从列表移除 → 去进度页查看。

<details><summary>你应该看到什么？</summary>

列表里不再包含论文1，但进度页仍然有它，状态仍是 Reading。论文库里的论文也没有被删除。

</details>

**过关标准：** 你能在不看教程的情况下重复这个流程，并解释“移出列表”和“删除论文”为什么不同。
