# DBComic

一个用来爬取《龙珠超次元乱战》漫画的脚本，可以自动下载官网的图片并生成PDF文件保存到本地。

支持增量下载，如果本地已经有了部分章节，可以只下载新的章节，避免重复下载。

## 使用方法

### 1. 安装依赖

```bash
npm install
```

### 2. 首次下载

```bash
npm run download
```

适用于第一次下载，之后再次运行时，不会从官网获取最新的章节

### 3. 更新漫画

```bash
npm run update
```

适用于已经下载过一次，之后再次运行时，会从官网获取最新的章节，然后下载新的章节

### 4. 运行效果

![运行效果](./assets/exec_result_1.png)

......

![运行效果](./assets/exec_result_2.png)

......

![运行效果](./assets/exec_result_3.png)

### 5. 查看漫画

生成的PDF文件在`./results/chapters/pdf`目录下，可以使用PDF阅读器打开。
同时，也在`./results/chapters/`下，也会包含所有章节的图片文件，可以直接查看，比如`./results/chapters/Chapter-1/Page-3.jpg`

## 说明

- 本项目仅供学习交流使用，方便大家阅读漫画，不得用于商业用途
- 官网地址：[龙珠超次元乱战]('https://www.dragonball-multiverse.com/cn/chapters.html?comic=page)，请大家多多支持漫画作者
- 欢迎提出建议和改进意见，以及Issues和PR
