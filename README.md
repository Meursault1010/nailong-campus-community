# 奶龙校园生活社区

河海大学金坛校区校园生活网页原型。仓库包含 Vue 3 / Three.js 前端、Node.js API、SQLite 演示数据逻辑和校园 3D 场景所需文件。

> GitHub 负责托管源代码，不会替这个 Node.js 应用运行后端。要让别人打开网页，需要把本仓库连接到 Render 等 Node.js Web Service 主机。单独启用 GitHub Pages 只能发布静态资源，不能运行本项目的 API、SQLite 和实时消息。

## 本机运行

需要 Node.js 22.5 或更新版本。

```powershell
npm ci
npm start
```

默认打开 `http://127.0.0.1:5179/`。如需比赛现场的隔离演示数据，可进入 `nailong-campus-community` 并运行 `.\Start-Competition-Demo.ps1`。

## 发布到 Render 并获得公网网址

1. 在 GitHub 建立公开仓库并推送本项目全部文件，保持仓库根目录包含 `nailong-campus-community`、`campus-3d` 和 `docs/金坛校区资料包/places.reference.json`。不要只上传 `nailong-campus-community` 子目录；校园模型和地点参考 JSON 是构建依赖。
2. 登录 Render，选择创建 **Blueprint** 并连接本 GitHub 仓库。仓库中的 `render.yaml` 会配置 Node Web Service、构建命令、启动命令和健康检查。仓库根目录的 npm workspace 会同时安装前端和 Three.js 校园场景依赖。
3. 点击部署并等待状态变成 Live。Render 会生成一个 `https://<服务名>.onrender.com` 网址；把这个网址发给评委或访问者即可。
4. 之后更新网页时，把改动推送到 GitHub 默认分支；Render 会按 Blueprint 配置重新部署。

如果不使用 Blueprint，也可以在 Render 新建 Web Service，并使用仓库根目录、Build Command `npm ci && npm run build` 和 Start Command `npm start`。

### SQLite 数据保存

Render 免费 Web Service 不能挂载持久化磁盘，并会在闲置后休眠。此模式适合比赛预览，但 SQLite 数据可能在服务重启或重新部署后丢失，重新唤醒也可能需要等待。需要保留帖子、账号和消息时，选择支持持久化磁盘的付费 Web Service，在 `/var/data` 挂载磁盘，并设置 `CAMPUS_DATA_DIR=/var/data`。创建付费服务前先确认平台当前的价格和账单规则。

## 当前能力边界

- 校园地点、建筑和空间布局是近似示意模型，不是测绘级地图。
- 演示账号不验证学校身份；课表、成绩、活动、人物和商品包含原型模拟数据。
- 集市只用于信息展示、议价与当面交接演示，不支持付款、担保或交易履约。
- 本机 Node.js 服务支持演示账号、社区动态、评论、点赞、商品、私信和实时事件；公网服务的安全、隐私、审核与备份仍需另行配置。
- 仓库公开后，源代码与随仓库提供的图片素材都可被他人浏览和下载。参赛前请确认图片、奶龙及其他第三方素材的许可范围。

校园场景代码位于 `campus-3d/`，前端与 API 位于 `nailong-campus-community/`。
