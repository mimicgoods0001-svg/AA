# 消除音效 merge.mp3

v1.0.8 消除（合成）时播放的音效，取自 MKV 的 00:01–00:02 秒。

## 生成方法

1. 安装 [ffmpeg](https://ffmpeg.org/download.html)。
2. 在终端执行（将路径改成你的 MKV 实际路径）：

```bash
ffmpeg -i "C:\Users\xin\Videos\2026-01-25 17-14-36.mkv" -ss 00:00:01 -to 00:00:02 -vn -acodec libmp3lame -q:a 4 "C:\Users\xin\Desktop\pjsk-merge-game\assets\merge.mp3" -y
```

3. 生成的 `merge.mp3` 应在本目录（`assets/`）。若未放置，游戏加载会报错，可暂时注释掉 `game.js` 中 `preload` 里的 `this.load.audio('merge', ...)` 一行。

若未放置 `merge.mp3`，游戏照常运行，仅不播放消除音效。
