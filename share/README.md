# 假条分享

把一张假条编码进链接，对方打开就能看到，不需要后端、不需要数据库。

## 怎么用

```bash
node tools/build-standalone.mjs leave   # 生成 leave/mobile-standalone.html
node share/build-share.mjs              # 生成 share/index.html
```

页面里的「分享」入口会拼出这样的链接：

```
https://你的域名/share/index.html#d=<base64url(JSON)>
```

`#d=` 后面是压缩过的 JSON：姓名、学号、类型、起止时间、原因、地点、审批人。
分享页读到后直接渲染成一张假条。

## 必须放到公网上

`share/index.html` 是一个自包含的静态页面（图片全部内联），但**必须托管在公网**
别人才能打开。本地 `file://` 和 APK 内部的 `appassets.local` 都只在你自己的设备里。

可选方案：

| 方案 | 操作 |
|---|---|
| GitHub Pages | 把 `share/index.html` 传到仓库，Settings → Pages 开启 |
| Netlify Drop | https://app.netlify.com/drop 直接把 `share` 文件夹拖进去 |
| 任意静态托管 | OSS / COS / Vercel / Cloudflare Pages，放一个 HTML 文件即可 |

部署时保持目录名为 `share`——页面按同级 `../share/index.html` 拼链接。

## 隐私

- base64 **只是编码不是加密**，拿到链接的人可以解出全部内容。不要转发给无关的人。
- 链接长度约 390 字符，聊天软件里可能折行；分享页对截断的链接会提示「链接不完整」。
- 离线（本地文件 / APK）时，页面不会生成链接，而是把假条整理成纯文字供复制。
