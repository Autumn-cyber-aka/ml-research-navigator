# 来源与独立实现边界

核对日期：2026-09-07。参考仓库当前 main 的树 SHA：b81891645135c4024ced583b03a9fe5742fcfd46。报告通过网页读取 main，未单独校验与此 SHA 内容一致。来源读取不等于复现其部署。

- [原仓库](https://github.com/cs411-alawini/sp26-cs411-team032-TEAM32)
- [最终报告](https://github.com/cs411-alawini/sp26-cs411-team032-TEAM32/blob/main/doc/stage_4/Final_Report.md)
- [已核对基础 DDL](https://github.com/cs411-alawini/sp26-cs411-team032-TEAM32/blob/b81891645135c4024ced583b03a9fe5742fcfd46/doc/stage_3/ddl.sql)
- [已核对扩展](https://github.com/cs411-alawini/sp26-cs411-team032-TEAM32/blob/b81891645135c4024ced583b03a9fe5742fcfd46/doc/stage_4/cp2_extended_features.sql)

报告概述（非我们的成果）：React/Express/MySQL 产品覆盖发现、阅读管理与讨论；团队缩减了部分分析功能以聚焦数据库业务。借鉴的是需求收敛与关系设计经验，不采用其实现或数据量作为个人证据。

DDL 核对：存在论文—作者、列表—论文关联表；扩展将每个用户的论文状态独立建表。基础 DDL 中 reviews 未见一人一文根评价唯一键，而报告提及唯一性保障；本轮未审计全部迁移，不能认定最终部署缺少它。后续我们会直接设计并测试约束。

独立判断：事务原子性不自动保证查重后插入无竞态；需结合唯一约束、锁策略与并发实验。新草案自定义字段、约束、时间戳、删除政策；只保留当前需求所需七表。

许可证：根目录与递归树未发现名称含 license 的文件；未确认重用许可，不默认可复制。未复制原代码、SQL、图片或数据到实现。若将来需要复用，先核对具体文件的许可和署名条件。项目名称沿用用户指定名称；公开介绍必须注明独立学习实现及参考来源，不能冒充原团队成员或课程提交。

fixture：本次由 AI 原创虚构，3 篇论文、3 位作者、4 条作者关系；年份为测试筛选而设，不是真实发表记录。无真实注册用户、审稿人或数据集评论。

技术依据：[Flask 模板与路由](https://flask.palletsprojects.com/en/stable/quickstart/)；[MySQL CHECK](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html)。MySQL 8.0.16 起执行 CHECK，不能用更早版本验证草案。运行验证仍待本地数据库。

## 2026-09-13 implementation update

The v2 fixture expands to 16 fictional papers, eight fictional authors and 30 paper-author relationships. No accounts or discussion activity are seeded. The implementation, schema additions, CSS, templates and tests were independently authored with AI assistance; no source repository code or dataset was reused.

Additional official references: [Flask security](https://flask.palletsprojects.com/en/stable/web-security/), [MySQL 8.4 downloads](https://dev.mysql.com/downloads/mysql/8.4.html), [MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html). Local database binary: MySQL 8.4.11 macOS ARM64, obtained from Oracle's CDN; published/downloaded archive MD5 matched `6e89113f04f2af85d0a164573493db3a`. This checksum records download integrity, not an independent security audit.
