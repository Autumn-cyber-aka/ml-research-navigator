# 第4—5课：读代码的字母表，跟着一次搜索走

[回目录](../LEARNING_GUIDE.md) · [上一课](02_TABLES_AND_SQL.md) · [下一课](04_HTML_AND_FIRST_EDIT.md)

**今天的目标：** 能认出一段 Python 在做什么，再把网页搜索和代码连起来。

## 1. 先认识六种写法

这些小例子只用来解释 Python，不会修改数据库。

```python
year = 2025
title = "Tiny Forest Classifiers"
```

`=` 是给名字放入一个值：year 记住2025，title 记住一段文字。引号中的文字叫字符串。不带引号的2025是数字。`==` 才是比较两个值是否相等。

```python
paper_ids = [1, 2, 3]
```

方括号是一份有顺序的**列表**，像购物清单。这里有三个编号。Python 的列表是代码中的容器；网页上的“阅读列表”是产品功能，虽然都叫列表，但不能混为一谈。

```python
paper = {"paper_id": 1, "title": "Tiny Forest Classifiers"}
print(paper["title"])
```

花括号里的这种配对叫**字典**：通过“字段名”找到对应的值。`paper["title"]` 取出标题，`print` 把它显示出来。

```python
if year == 2025:
    print("这是2025年的论文")
```

`if` 是“如果”。冒号后面缩进去的内容，属于这个条件里的操作。Python 把缩进当结构，不能随便抹掉空格。

```python
for paper_id in paper_ids:
    print(paper_id)
```

`for` 表示挨个处理。输出1、2、3，每个一行。

```python
def double(number):
    return number * 2

answer = double(3)
```

`def` 定义一个**函数**：给一小包操作起名字，方便重复使用。number 是输入，return 是返回结果。调用 double(3) 得到6，再交给 answer。

`#` 后面是注释，通常给人解释代码，不是要执行的操作。`from ... import ...` 表示把别处已经写好的工具拿来用。

## 2. 给不同符号一点位置感

|写法|此处意思|
|---|---|
|`papers()`|调用名叫 papers 的函数|
|`(1,)`|只装一个元素的元组，可先理解为固定的一组输入；逗号不能省|
|`request.args`|访问 request 的 args 属性|
|`None`|这里没有值|
|`True` / `False`|是 / 否|
|`return`|把结果交回调用者|
|`not`|反过来判断，例如“不是”|

先认识，不需要一次掌握所有 Python 语法。

## 3. 请求和响应是什么？

你向管理员说“找标题里有 Tiny 的论文”，这是**请求**。管理员给你结果，这是**响应**。

浏览器把请求发给网页服务器，Flask 帮我们的 Python 程序接收它。服务器不是一定指某种昂贵机器；你电脑上的一个程序也可以充当服务器。

打开 [`navigator/routes.py`](../../navigator/routes.py)，搜索 `def papers():`。附近有：

```python
@bp.get("/")
@bp.get("/papers")
def papers():
    ...  # 此处暂时省略函数内部，下面逐步讲解
```

以 `@` 开头的行叫装饰器，这里先理解为贴在函数上的“接待地址标签”：GET 请求访问 `/` 或 `/papers`，就交给 papers 函数处理。

`GET` 常用于读取；`POST` 常用于提交修改。它们是请求类型，不是按钮的颜色。我们的写操作使用 POST，并做额外检查。

## 4. 输入的 Tiny 是怎样进来的？

在 [`navigator/templates/papers.html`](../../navigator/templates/papers.html) 搜索 `name="q"`。这个输入框的名字叫 q。

点击 Search papers 后，地址可能变成 `/papers?q=Tiny&author=&year=`。问号后面是查询参数，`q=Tiny` 表示 q 这个输入的值是 Tiny。并不需要自己手写这个地址，表单会帮忙。

回到 routes.py，找到 catalogue_filters：

```python
term = request.args.get("q", "").strip()
```

分开读：

1. `request`：当前收到的请求。
2. `.args`：地址里的查询参数。
3. `.get("q", "")`：取 q；没有时用空字符串。
4. `.strip()`：去掉头尾的空白。
5. `term =`：把结果记在 term 这个名字下。

输入 `  Tiny  ` 时，term 最后就是 `Tiny`。

## 5. 为什么 SQL 和输入分开放？

实际代码会拼出固定的查询结构，把输入放在 params 中，交给数据库驱动：

```python
query("SELECT * FROM papers WHERE paper_id=%s", (1,), one=True)
```

这是项目中查询方式的简化例子。`%s` 是放数据的位置；`(1,)` 是要放进去的数据。数据库驱动 PyMySQL 负责正确处理它们。

不要把用户输入直接接进 SQL 字符串。恶意输入可能看起来像一段指令；**参数化查询**让输入按数据处理。这不是只检查某几个危险单词。

`one=True` 是告诉我们的 query 函数：“只取一行。”否则默认取所有返回行。

## 6. query 函数去哪里找？

打开 [`navigator/db.py`](../../navigator/db.py)，找到：

```python
def query(sql, args=(), *, one=False):
    with get_db().cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchone() if one else cur.fetchall()
```

逐行意思：

- sql 是查询文字，args 是输入的数据。`*` 表示它后面的参数要写名字，例如 `one=True`，暂时记住调用方式即可。
- get_db() 取得本次请求使用的数据库连接。
- cursor（游标）是执行语句、读取结果的工具；可以先想成管理员手里的查询窗口。
- `with` 管好这个工具的使用范围，离开后关闭游标。
- execute 把 SQL 和参数交给数据库。
- fetchone 取一行，fetchall 取全部结果行。

## 7. 最后怎样回到网页？

papers 函数最后调用：

```python
render_template("papers.html", ...)
```

省略号在这里表示课文略去了其他参数，不是让你把它复制替换原代码。原文件会把论文、作者、页数等真实数据传进去。

render_template 把数据填入网页模板，得到 HTML，浏览器再把它显示出来。

完整路线：

```text
输入框 q
  → 浏览器发送 GET /papers?q=Tiny
  → routes.py 中的 papers()
  → catalogue_filters() 读取输入并准备条件
  → db.py 中 query() 调用 MySQL
  → 返回论文数据
  → attach_authors() 补上作者
  → papers.html / macros.html 显示结果
```

分页就是把结果分成几页，每页12篇。page=2 时跳过前12篇；ORDER BY 中的编号保证同年论文也有明确顺序。

## 小任务

输入框的 q 改名为 keyword，但 Python 仍取 q，会发生什么？`return` 和 `print` 有什么区别？

<details><summary>参考答案</summary>

Python 收不到新的 keyword，q 会使用空字符串，搜索条件可能失效。输入框名字与后端读取名字必须对应。

print 把内容显示到输出窗口；return 把值交给调用函数的地方使用。网页内容不是靠在服务器里 print 出来的。

</details>

**过关标准：** 你能用手指着真实文件，说明 Tiny 从哪里来、经过哪里、最后去哪里。
