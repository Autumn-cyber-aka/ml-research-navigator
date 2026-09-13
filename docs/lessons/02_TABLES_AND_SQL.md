# 第2—3课：表格、编号和找资料的指令

[回目录](../LEARNING_GUIDE.md) · [上一课](01_USE_THE_APP.md) · [下一课](03_PYTHON_AND_REQUESTS.md)

**今天的目标：** 认识三张表，读懂一条查询。先手算，不一定要运行数据库命令。

## 1. 先想象一张纸上的表格

论文表的部分内容是：

|paper_id|title|publication_year|
|---|---|---|
|1|Tiny Forest Classifiers|2025|
|2|Reading Graph Representations|2024|
|3|Evaluating Small Predictors|2025|

- 一张**表**保存一类东西，这里是一类叫论文的东西。
- 一**行**是一篇具体论文。
- 一**列**是一种信息，比如标题或年份。
- **字段**通常指某一列；**记录**通常指某一行。

数据库可以理解为由程序管理的一组资料表。MySQL 是管理这些资料的具体软件。SQL 是我们向它提出查找或修改要求时使用的语言。

## 2. 为什么有 paper_id？

`id` 可以先理解为编号。`paper_id=1` 精确指出第一篇论文。

标题可能重复，也可能改正拼写。编号更适合长期指向同一篇论文。**主键（PRIMARY KEY）**就是一张表用来唯一认出每行的字段或字段组合。

打开 [`sql/schema.sql`](../../sql/schema.sql)，找到：

```sql
paper_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
```

每一块的意思：

|代码|意思|
|---|---|
|paper_id|这一列叫“论文编号”|
|BIGINT|装一个较大范围的整数|
|UNSIGNED|不用负数|
|AUTO_INCREMENT|没手动给编号时，让数据库生成递增编号|
|PRIMARY KEY|每行靠它辨认，不能重复，也不能缺失|

编号可能有空缺，不要用“最大编号”代替“论文数量”。

继续看：

```sql
title VARCHAR(500) NOT NULL
```

`VARCHAR(500)` 表示最多500个字符的文字；`NOT NULL` 表示不能没有这个值。注意，空字符串 `''` 仍是一个值，所以我们还用 CHECK 规则拒绝空白标题。

`NULL` 表示没有已知值，不等于数字0，也不等于空字符串。

## 3. 作者应该放在哪里？

作者表里是：

|author_id|display_name|
|---|---|
|1|Sample Researcher A|
|2|Sample Researcher B|
|3|Sample Researcher C|

如果把两个作者写成论文表里的一个大字符串，后面就很难可靠地知道某个人写了哪些论文，还会遇到同名、分隔符和顺序问题。

所以加一张配对名单：`paper_authors`。

|paper_id|author_id|author_order|
|---|---|---|
|1|1|1|
|1|2|2|
|2|2|1|
|3|3|1|

读第一行：“论文1，有作者1，他排第1位。”

读第二行：“论文1，还有作者2，他排第2位。”

一篇论文可以有多个作者，一个作者也可以写多篇论文，这就叫**多对多**。关联表负责保存这些配对。

## 4. 三种规则，不要混在一起

|规则|本项目例子|阻止什么错误|
|---|---|---|
|主键|`(paper_id, author_id)`|同一篇论文重复挂上同一个作者|
|唯一键 UNIQUE|`(paper_id, author_order)`|同一篇论文出现两个第1作者位置|
|外键 FOREIGN KEY|author_id 必须引用 authors 的编号|把不存在的作者99挂上论文|

括号里有两列，表示看“这一对”是否重复，不是说每列单独都不能重复。

外键像核对身份证号是否在册。它不能证明当前登录的人有权限修改这条数据；权限是后面一课的事。

## 5. SQL 从一句话开始

下面都是**SQL**，暂时阅读即可，不要直接粘贴到普通终端。

```sql
SELECT title FROM papers;
```

读成：“从 papers 表中，取出 title 列。”`SELECT` 是选取，`FROM` 是从哪里取。分号表示一句结束。

```sql
SELECT paper_id, title
FROM papers
WHERE paper_id = 1;
```

`WHERE` 是筛选条件。这次只要编号1，应该得到一行 Tiny Forest Classifiers。

```sql
SELECT paper_id, title
FROM papers
WHERE publication_year = 2025
ORDER BY paper_id
LIMIT 2;
```

- 先找2025年的论文。
- 再按论文编号从小到大排列。`ORDER BY` 就是排序。
- 最后只拿前两行。`LIMIT` 就是限制数量。

按当前样例，结果应该是论文1和论文3。`DESC` 表示倒序，`ASC` 表示正序；不写时这里默认正序。

## 6. JOIN：把编号换成人能读懂的名字

```sql
SELECT p.title, a.display_name, pa.author_order
FROM papers AS p
JOIN paper_authors AS pa ON pa.paper_id = p.paper_id
JOIN authors AS a ON a.author_id = pa.author_id
WHERE p.paper_id = 1
ORDER BY pa.author_order;
```

不要一口气背。分四步读：

1. `AS p` 给 papers 起个短名字 p。于是 `p.title` 是“论文表的标题”。
2. 第一次 JOIN：按 paper_id，把论文和配对名单对起来。
3. 第二次 JOIN：按 author_id，把配对名单里的作者编号变成作者名字。
4. 只留下论文1，按作者顺序排列。

应该得到：

|title|display_name|author_order|
|---|---|---|
|Tiny Forest Classifiers|Sample Researcher A|1|
|Tiny Forest Classifiers|Sample Researcher B|2|

有两行不代表论文重复存了两次。结果每行表达的是“论文与一位作者的组合”。

## 7. 想亲自执行？选与你的启动方式一致的一条

**Docker 启动的项目：** 在项目根目录的终端执行：

```bash
docker compose exec db mysql -u navigator -p navigator
```

输入你本地 `.env` 中的 MYSQL_PASSWORD（不把它粘进聊天）。出现 `mysql>` 后，才能粘贴上面的 SQL。密码输入时不显示字符是正常的。输入 `exit` 退出。

**已经配置好的原生 Python/MySQL 项目，包括本机的初始实现环境：** 终端中执行：

```bash
source .venv/bin/activate
python -m flask --app navigator shell
```

第一句启用项目自己的 Python 环境，第二句打开已经连接到应用配置的 Python 交互窗口。看到 `>>>` 后，逐行输入：

```python
from navigator.db import query
query("SELECT paper_id, title FROM papers WHERE paper_id = %s", (1,))
```

这里外面是 Python，引号里面才是 SQL。结果大致是：

```python
[{'paper_id': 1, 'title': 'Tiny Forest Classifiers'}]
```

方括号表示一组结果，里面这一项是一篇论文。输入 `exit()` 退出 Python 窗口。

不要把示例中的 `>>>` 或 `mysql>` 一起复制，它们是窗口提示符，不是命令。

## 8. 其余表先记住职责

|表|一句话用途|
|---|---|
|users|账户|
|reading_lists|谁拥有哪份清单|
|list_papers|哪份清单收了哪篇论文|
|reading_states|哪个用户对哪篇论文读到哪了|
|reviews|评分和评价|
|posts|讨论帖子|
|replies|帖子下的回复|
|auth_sessions|仍然有效的登录会话|
|login_attempts|近期登录尝试，用来限制频繁尝试|

连同前三张，这部分共12张表。第13课新增3张点赞表，所以完整项目现在有15张表。先理解前三张，再回来读其余表的键。

## 小任务与答案

1. 论文1新增加作者3，并排在第3位，配对名单应该增加什么？
2. 修改论文1的标题，需要修改 paper_authors 吗？
3. 为何不能让论文1再次出现作者1？

<details><summary>参考答案</summary>

1. `(paper_id=1, author_id=3, author_order=3)`。这是纸上练习，不要求修改样例数据库。
2. 不需要。配对关系用编号指向论文，不保存它的标题。
3. 同一个论文—作者关系只需保存一次，复合主键防止重复。

</details>

**过关标准：** 你能解释那条 JOIN 为何输出两行。
