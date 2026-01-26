/**
 * PJSK 吧唧合成游戏 - 完整版
 * 基于 PRD 需求重写
 * 合成逻辑：A掉到B上，B升级，A消失
 * 
 * 版本历史：
 * v1.0.0 - 初始版本（2026-01-25）
 * v1.0.1 - 预览下一吧唧、全屏点击有效、perfect 保留宽高比
 * v1.0.2 - 预览渐入效果；投放时先沿 X 轴平移到点击 X，再在预览 Y 处自由落体
 * v1.0.3 - 动态掉落：场上有L5+时掉落1-4，场上有L6+时掉落1-5（最大），概率均等
 * v1.0.4 - 斩杀线：任意部分过线即计入；新增倒计时可视化显示
 * v1.0.5 - 斩杀线重写：新吧唧 2 秒保护；任意吧唧顶部过线触发 10 秒倒计时
 * v1.0.6 - 斩杀线：取消常驻显示和倒计时显示；触发时显示并闪烁
 * v1.0.7 - UI 优化：昼间背景渐变、圆形主题按钮、结算画面重设计、生成游戏截图
 * v1.0.8 - 昼间主题按钮白色、iOS 高 DPR 画质、消除音效
 * v1.0.9 - DPR 同比调整：重力、UI 大小、文字大小
 * v1.1.0 - 分数改为圆体+浅蓝描边、"合计市价"、"您已读博"、合成间隔优化
 * v1.1.1 - 合计市价字号缩小、您已读博加"个"、欢迎POPUP、合计市价改为场上吧唧总和
 * v1.1.2 - iOS跳转修复、POPUP优化、音乐系统、设置面板
 * v1.1.3 - POPUP文案调整、OP音乐修复、设置面板文案残留修复、设置面板时阻止投放
 * v1.1.4 - 修复所有POPUP的小红书跳转（iOS兼容）、重做结算画面POPUP
 * v1.1.5 - 结算画面布局调整、合成次数改为合计市价、修复分享图片黑屏
 * v1.1.6 - 恢复结算页UI调整、流星背景效果
 * v1.1.7 - 流星加速、随机生成数量、随机起点
 * v1.1.8 - 统一合成糕特成功POPUP设计；合成糕特成功后继续玩被斩杀线判定失败时按成功处理
 */

// 屏幕尺寸计算（考虑移动端浏览器UI）
const screenSize = (() => {
    const width = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return { width, height };
})();

const GAME_WIDTH = screenSize.width;
const GAME_HEIGHT = screenSize.height;
const KILL_LINE_Y = GAME_HEIGHT / 6.67;       // 斩杀线位置（屏幕上方1/6.67处）
const PREVIEW_Y = KILL_LINE_Y - 50;           // 预览下一吧唧的 y（斩杀线上方居中）
const KILL_PROTECTION_MS = 2000;              // 新吧唧释放后保护时间（毫秒）
const KILL_COUNTDOWN_MS = 10000;              // 斩杀线倒计时时长（毫秒）

// v1.0.8: 高 DPR 画质（iOS/Retina），逻辑像素 -> 物理像素
const DPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
const px = (x) => (typeof x === 'number' ? x * DPR : x);
// v1.0.9: 字体大小按 DPR 缩放
const fs = (size) => Math.round(size * DPR) + 'px';

// 吧唧等级配置（保留原有图片路径）
const BADGE_LEVELS = [
    { level: 1, radius: 20, score: 45, name: '纽扣', variants: ['1_ctn.png', '1_an.png', '1_saki.png'] },
    { level: 2, radius: 31, score: 45, name: '纽扣', variants: ['2_tks.png', '2_akt.png', '2_shiho.png'] },
    { level: 3, radius: 39, score: 45, name: '纽扣', variants: ['3_emu.png', '3_khn.png', '3_ick.png'] },
    { level: 4, radius: 44, score: 45, name: '纽扣', variants: ['4_rui.png', '4_toya.png', '4_hnm.png'] },
    { level: 5, radius: 47, score: 100, name: '新队服', variants: ['5_ena.png', '5_airi.png'] },
    { level: 6, radius: 62, score: 100, name: '新队服', variants: ['6_mzk.png', '6_szk.png'] },
    { level: 7, radius: 68, score: 100, name: '新队服', variants: ['7_mfy.png', '7_mnr.png'] },
    { level: 8, radius: 74, score: 100, name: '新队服', variants: ['8_knd.png', '8_hrk.png'] },
    { level: 9, radius: 80, score: 300, name: '人鱼', variants: ['9_ng.png', '9_tks.png'] },
    { level: 10, radius: 86, score: 300, name: 'idk', variants: ['10_idk.png', '10_knd.png'] },
    { level: 11, radius: 95, score: 3000, name: '糕特', variants: ['gaote/saki.png', 'gaote/airi.png', 'gaote/akt.png', 'gaote/an.png', 'gaote/emu.png', 'gaote/ena.png', 'gaote/hnm.png', 'gaote/hrk.png', 'gaote/knd.png', 'gaote/mfy.png', 'gaote/mnr.png', 'gaote/mzk.png', 'gaote/nene.png', 'gaote/rui.png', 'gaote/shiho.png', 'gaote/szk.png', 'gaote/tks.png', 'gaote/toya.png'] }
];

// 称号系统
const TITLES = [
    { min: 0, max: 500, name: '吃土萌新' },
    { min: 500, max: 2000, name: '资深谷美' },
    { min: 1500, max: 5000, name: '海景房房东' },
    { min: 3000, max: 88887, name: '石油王' },
    { min: 4000, max: Infinity, name: '谷圈太太' }
];

// 游戏状态
let gameState = {
    currentTheme: 'day', // 'day' 或 'night'
    selectedVariant: {}, // 每局随机选定的角色变体
    totalScore: 0,
    gameOver: false,
    badges: [], // 所有吧唧对象
    isDropping: false, // 是否正在掉落中
    overKillLineTime: 0, // 斩杀线倒计时已累计时间（毫秒）
    totalDrops: 0,   // 累计读博（本轮掉落吧唧数量）
    totalMerges: 0,  // 合成次数
    hasWon: false,   // 是否已合成过 11 级（用于胜利后继续游戏）
    nextBadgeLevel: 1,  // 下一个将出现的吧唧等级（1–3），用于预览
    showWelcomePopup: true, // v1.1.2: 是否显示欢迎POPUP
    bgmVolume: 0.5,  // v1.1.2: 背景音乐音量（0-1）
    sfxVolume: 0.7  // v1.1.2: 音效音量（0-1）
};

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // 加载所有吧唧图片（保留原有路径）
        BADGE_LEVELS.forEach(level => {
            level.variants.forEach(variant => {
                const key = `b_${level.level}_${variant}`;
                const path = `assets/${variant}`;
                this.load.image(key, path);
            });
        });
        
        // 加载特效与结算素材
        this.load.image('perfect', 'assets/perfect.png');
        this.load.image('mimicStore', 'assets/mimic-icon/MimicStore.png');
        // v1.1.7: 加载Mimic谷店logo用于流星效果
        this.load.image('mimic', 'assets/mimic-icon/Mimic.png');
        // v1.0.8: 消除音效（00:01–00:02）；merge.mp3 需自行提取，见 assets/merge-音效说明.md
        this.load.audio('merge', 'assets/merge.mp3');
        // v1.1.2: 欢迎POPUP音乐和背景音乐
        this.load.audio('op', 'assets/pjsk-merge-op.mp3');
        this.load.audio('bgm-nene', 'assets/pjsk-merge-g-nene.mp3');
        this.load.audio('bgm-rui', 'assets/pjsk-merge-g-rui.mp3');
        this.load.audio('bgm-bug', 'assets/pjsk-merge-g-bug.mp3');
        this.load.audio('bgm-mmj', 'assets/pjsk-merge-g-mmj.mp3');
        this.load.audio('bgm-vbs', 'assets/pjsk-merge-g-vbs.mp3');
        this.load.audio('bgm-ln', 'assets/pjsk-merge-g-ln.mp3');
    }

    create() {
        // 设置物理世界边界（v1.0.8: 物理像素）
        this.matter.world.setBounds(0, 0, px(GAME_WIDTH), px(GAME_HEIGHT), 32, true, true, true, true);
        
        // 初始化游戏
        this.initGame();
        
        // 创建UI
        this.createUI();
        
        // v1.1.2: 初始化音乐系统
        this.bgmList = ['bgm-nene', 'bgm-rui', 'bgm-bug', 'bgm-mmj', 'bgm-vbs', 'bgm-ln'];
        this.currentBgmIndex = -1;
        this.currentBgm = null;
        this.opMusic = null;
        
        // v1.1.5: 游戏截图缓存（游戏结束时自动截图）
        this.gameScreenshot = null;
        
        // v1.1.6: 初始化流星效果
        // v1.1.7: 每2秒生成1~3个流星，现在翻倍为2~6个
        this.meteorEmojis = ['🐱', '🐶', '🐰', '🐻', '🐼', '🦊', '🐯', '🦁', '🐨', '🐸', '🐷', '🐮', '⭐', '✨', '🌟', '💫', '⭐️', '✨️'];
        this.meteorImages = ['mimic']; // Mimic谷店logo
        this.meteors = [];
        this.meteorTimer = 0;
        this.meteorInterval = 2000; // 每2秒生成一批流星
        
        // v1.1.1: 显示欢迎POPUP
        if (gameState.showWelcomePopup) {
            this.showWelcomePopup();
        }
        
        // 设置输入
        this.setupInput();
        
        // 设置碰撞检测
        this.setupCollision();
    }

    initGame() {
        // 每局随机选定角色变体（同等级只出现一个角色）
        BADGE_LEVELS.forEach(level => {
            gameState.selectedVariant[level.level] = Phaser.Utils.Array.GetRandom(level.variants);
        });
        
        // 重置游戏状态
        gameState.totalScore = 0;
        gameState.gameOver = false;
        gameState.badges = [];
        gameState.isDropping = false;
        gameState.overKillLineTime = 0;
        gameState.totalDrops = 0;
        gameState.totalMerges = 0;
        gameState.hasWon = false;
        gameState.nextBadgeLevel = this.calculateNextBadgeLevel();
        gameState.showWelcomePopup = true; // v1.1.2: 重置欢迎POPUP标志
        
        this.overKillLineTime = 0;
        this.mergingBadges = new Set();
    }

    /**
     * 获取场上当前存在的最高等级吧唧
     * @returns {number} 最高等级，如果没有吧唧则返回 0
     */
    getMaxBadgeLevelOnField() {
        if (!gameState.badges || gameState.badges.length === 0) return 0;
        let maxLevel = 0;
        gameState.badges.forEach(badge => {
            if (badge && badge.active && badge.getData) {
                const level = badge.getData('level');
                if (level !== undefined && level > maxLevel) {
                    maxLevel = level;
                }
            }
        });
        return maxLevel;
    }

    /**
     * 根据场上最高等级计算下一个可掉落的吧唧等级
     * 规则：
     * - 默认：掉落 1-3
     * - 场上有 L5 或以上：掉落 1-4（所有等级概率均等）
     * - 场上有 L6 或以上：掉落 1-5（最大，所有等级概率均等）
     * @returns {number} 下一个可掉落的等级（1-5）
     */
    calculateNextBadgeLevel() {
        const maxLevel = this.getMaxBadgeLevelOnField();
        let maxDropLevel = 3; // 默认最大掉落等级为 3
        
        if (maxLevel >= 6) {
            // 场上有 L6 或以上，可以掉落 1-5
            maxDropLevel = 5;
        } else if (maxLevel >= 5) {
            // 场上有 L5 或以上，可以掉落 1-4
            maxDropLevel = 4;
        }
        
        // 所有可能掉落的等级概率均等
        return Phaser.Math.Between(1, maxDropLevel);
    }

    createUI() {
        // 创建背景（根据主题）
        this.updateBackground();
        
        // 分数显示（v1.1.1: 字号缩小到 fs(20)，与您已读博一致）
        const scoreY = px(20);
        this.scoreText = this.add.text(px(20), scoreY, '合计市价: $0', {
            fontSize: fs(20),
            fill: '#fff',
            stroke: '#87CEEB', // v1.1.0: 浅蓝色描边（第190行）
            strokeThickness: px(3),
            fontFamily: '"Arial Rounded MT Bold", "Helvetica Rounded", "Comic Sans MS", Arial, sans-serif'
        });
        
        // 您已读博显示（v1.1.1: 添加"个"）
        const scoreFontSize = Math.round(20 * DPR);
        const dropsY = scoreY + scoreFontSize * 1.2;
        this.dropsText = this.add.text(px(20), dropsY, '您已读博: 0个', {
            fontSize: fs(20),
            fill: '#fff',
            stroke: '#87CEEB',
            strokeThickness: px(3),
            fontFamily: '"Arial Rounded MT Bold", "Helvetica Rounded", "Comic Sans MS", Arial, sans-serif'
        });
        
        // 斩杀线（v1.0.6：不再常驻显示，触发时动态创建）
        this.killLine = null;
        this.killLineBlinkTween = null;
        
        // 主题切换按钮（右上角，圆形设计，☀️昼间 / 🌙夜间）
        const themeX = px(GAME_WIDTH - 50);
        const themeY = px(50);
        const themeRadius = px(24);
        
        // v1.1.2: 设置按钮（📢，主题按钮左边，再往左移动10px）
        const settingsRadius = px(24);
        const settingsX = themeX - themeRadius - settingsRadius - px(10); // 主题按钮右边缘 - 音量按钮半径 - 10px（往左移动）
        const settingsY = px(50);
        this.settingsButton = this.add.circle(settingsX, settingsY, settingsRadius, 0xFFB6C1, 0.9)
            .setInteractive({ useHandCursor: true })
            .setStrokeStyle(px(2), 0xFFC0CB, 1)
            .on('pointerdown', () => {
                if (this.settingsPanel) {
                    this.closeSettingsPanel();
                } else {
                    this.showSettingsPanel();
                }
            })
            .on('pointerover', function() { this.setScale(1.1); })
            .on('pointerout', function() { this.setScale(1); });
        this.settingsText = this.add.text(settingsX, settingsY, '📢', {
            fontSize: fs(20),
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setDepth(10);
        this.settingsPanel = null;
        
        this.themeButton = this.add.circle(themeX, themeY, themeRadius, gameState.currentTheme === 'day' ? 0xFFFFFF : 0x4A5568, 0.9)
            .setInteractive({ useHandCursor: true })
            .setStrokeStyle(px(2), gameState.currentTheme === 'day' ? 0xE0E0E0 : 0x2D3748, 1)
            .on('pointerdown', () => {
                gameState.currentTheme = gameState.currentTheme === 'day' ? 'night' : 'day';
                this.updateBackground();
                // v1.0.6: 如果斩杀线存在，更新其颜色
                if (this.killLine) this.updateKillLine();
                // 更新按钮颜色和图标（v1.0.8: 昼间白色）
                this.themeButton.setFillStyle(gameState.currentTheme === 'day' ? 0xFFFFFF : 0x4A5568, 0.9);
                this.themeButton.setStrokeStyle(px(2), gameState.currentTheme === 'day' ? 0xE0E0E0 : 0x2D3748, 1);
                this.themeText.setText(gameState.currentTheme === 'day' ? '☀️' : '🌙');
                this.themeText.setColor(gameState.currentTheme === 'day' ? '#333' : '#fff');
            })
            .on('pointerover', function() {
                this.setScale(1.1);
            })
            .on('pointerout', function() {
                this.setScale(1);
            });
        
        this.themeText = this.add.text(themeX, themeY, gameState.currentTheme === 'day' ? '☀️' : '🌙', {
            fontSize: fs(20),
            fill: gameState.currentTheme === 'day' ? '#333' : '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setDepth(10);
        
        // v1.0.6: 取消倒计时文本显示
        
        this.createPreviewBadge();
    }
    
    /**
     * v1.1.2: 显示欢迎POPUP（粉红色和浅蓝色主题，自动换行，阻止输入，播放OP音乐）
     */
    showWelcomePopup() {
        const cx = px(GAME_WIDTH / 2);
        const cy = px(GAME_HEIGHT / 2);
        const MIMIC_URL = 'https://www.xiaohongshu.com/user/profile/64620111000000002a00b1ab?xsec_token=YBW46oIJMPlwXdn-p_dC82jR5R1LhesqZNoZiksdd53SA=&xsec_source=app_share&xhsshare=CopyLink&shareRedId=ODpDQTM-PUE2NzUyOTgwNjczOThKOjY-&apptime=1769156949&share_id=e626a77e05c44cccb0cb838d8148d677';
        
        // v1.1.2: 阻止游戏输入和逻辑
        gameState.showWelcomePopup = true;
        
        // 随机动物emoji
        const animals = ['🐱', '🐶', '🐰', '🐻', '🐼', '🦊', '🐯', '🦁', '🐨', '🐸', '🐷', '🐮'];
        const randomAnimal = animals[Phaser.Math.Between(0, animals.length - 1)];
        
        // 背景遮罩（阻止点击）
        const overlay = this.add.rectangle(cx, cy, px(GAME_WIDTH), px(GAME_HEIGHT), 0x000000, 0.7).setDepth(300).setInteractive();
        
        // 主面板（v1.1.2: 粉红色和浅蓝色主题）
        const panelW = px(Math.min(GAME_WIDTH * 0.88, 500));
        const panelH = px(450);
        const panelBg = this.add.rectangle(cx, cy, panelW, panelH, 0xF8D5D2, 0.95).setDepth(301);
        const panelBorder = this.add.rectangle(cx, cy, panelW, panelH, 0xA4B4C4, 0).setDepth(301).setStrokeStyle(px(4), 0xFFB6C1, 1);
        
        let y = cy - panelH / 2 + px(40);
        
        // 标题
        const tTitle = this.add.text(cx, y, 'PJSK-合成大海景', {
            fontSize: fs(28),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#A4B4C4',
            strokeThickness: px(2)
        }).setOrigin(0.5).setDepth(302);
        y += px(50);
        
        // v1.1.3: 欢迎文字（调整文案）
        const welcomeText = `欢迎来到合成大海景${randomAnimal}`;
        const tWelcome = this.add.text(cx, y, welcomeText, {
            fontSize: fs(20),
            fill: '#fff',
            fontFamily: 'Arial',
            stroke: '#A4B4C4',
            strokeThickness: px(1)
        }).setOrigin(0.5, 0).setDepth(302).setWordWrapWidth(panelW - px(60));
        y += tWelcome.height + px(20);
        
        // v1.1.3: 说明文字（调整为两行）
        const descText1 = '点击画面，不断读博新的吧唧';
        const tDesc1 = this.add.text(cx, y, descText1, {
            fontSize: fs(18),
            fill: '#666',
            fontFamily: 'Arial'
        }).setOrigin(0.5, 0).setDepth(302).setWordWrapWidth(panelW - px(60));
        y += tDesc1.height + px(8);
        
        const descText2 = '并将它们合成，最终合成大海景！';
        const tDesc2 = this.add.text(cx, y, descText2, {
            fontSize: fs(18),
            fill: '#666',
            fontFamily: 'Arial'
        }).setOrigin(0.5, 0).setDepth(302).setWordWrapWidth(panelW - px(60));
        y += tDesc2.height + px(50);
        
        // 开始游戏按钮（底色改为#A4B4C4）
        const btnStart = this.add.rectangle(cx, y, px(220), px(50), 0xA4B4C4, 1)
            .setInteractive({ useHandCursor: true }).setDepth(302)
            .setStrokeStyle(px(3), 0xFFC0CB, 1)
            .on('pointerdown', () => {
                // v1.1.2: 停止OP音乐，开始背景音乐（3秒渐出）
                if (this.opMusic) {
                    this.tweens.add({
                        targets: this.opMusic,
                        volume: 0,
                        duration: 3000,
                        onComplete: () => {
                            if (this.opMusic) this.opMusic.stop();
                            this.opMusic = null;
                        }
                    });
                }
                this.startBackgroundMusic();
                
                // v1.1.3: 关闭POPUP（销毁所有元素，包括logo）
                if (this.welcomePopupElements) {
                    this.welcomePopupElements.forEach(el => { if (el && el.destroy) el.destroy(); });
                    this.welcomePopupElements = null;
                }
                
                // v1.1.2: 允许游戏输入和逻辑
                gameState.showWelcomePopup = false;
            })
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const tStart = this.add.text(cx, y, '我明白了，开读！', {
            fontSize: fs(18),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(303);
        y += px(60);
        
        // 关注Mimic谷店按钮（v1.1.2: iOS兼容跳转，改为粉色）
        const btnMimic = this.add.rectangle(cx, y, px(240), px(44), 0xFFB6C1, 1)
            .setInteractive({ useHandCursor: true }).setDepth(302)
            .setStrokeStyle(px(2), 0xFFC0CB, 1)
            .on('pointerdown', () => {
                // v1.1.4: 使用网页链接跳转（iOS兼容）
                window.location.href = MIMIC_URL;
            })
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const tMimic = this.add.text(cx, y, '关注Mimic谷店小红书', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(303);
        y += px(50);
        
        // v1.1.3: 添加Mimic谷店logo（保持长宽比，向下移动，放大1倍）
        const logoMaxSize = px(160);
        const logoY = y + px(20); // 向下移动一些
        const logoImg = this.add.image(cx, logoY, 'mimicStore');
        // 获取原始图片尺寸，保持长宽比
        const logoTexture = this.textures.get('mimicStore');
        const logoOrigWidth = logoTexture.source[0].width;
        const logoOrigHeight = logoTexture.source[0].height;
        const logoAspectRatio = logoOrigWidth / logoOrigHeight;
        let logoDisplayWidth, logoDisplayHeight;
        if (logoAspectRatio > 1) {
            // 宽大于高
            logoDisplayWidth = logoMaxSize;
            logoDisplayHeight = logoMaxSize / logoAspectRatio;
        } else {
            // 高大于等于宽
            logoDisplayHeight = logoMaxSize;
            logoDisplayWidth = logoMaxSize * logoAspectRatio;
        }
        logoImg.setDisplaySize(logoDisplayWidth, logoDisplayHeight);
        logoImg.setOrigin(0.5);
        logoImg.setDepth(303);
        
        // v1.1.2: 播放OP音乐（2秒渐入）
        // v1.1.3: 修复播放问题 - 延迟播放确保音频已加载
        this.time.delayedCall(100, () => {
            if (this.cache.audio.exists('op')) {
                try {
                    this.opMusic = this.sound.add('op', { volume: 0, loop: false });
                    this.opMusic.play();
                    // 3秒渐入，分4个阶段：第一秒10%，第二秒40%，第三秒70%，第四秒100%
                    const targetVolume = gameState.bgmVolume;
                    this.opMusic.setVolume(0);
                    
                    // 第一阶段：0 -> 10% (0-0.75秒)
                    this.tweens.add({
                        targets: this.opMusic,
                        volume: targetVolume * 0.1,
                        duration: 750,
                        onComplete: () => {
                            // 第二阶段：10% -> 40% (0.75-1.5秒)
                            this.tweens.add({
                                targets: this.opMusic,
                                volume: targetVolume * 0.4,
                                duration: 750,
                                onComplete: () => {
                                    // 第三阶段：40% -> 70% (1.5-2.25秒)
                                    this.tweens.add({
                                        targets: this.opMusic,
                                        volume: targetVolume * 0.7,
                                        duration: 750,
                                        onComplete: () => {
                                            // 第四阶段：70% -> 100% (2.25-3秒)
                                            this.tweens.add({
                                                targets: this.opMusic,
                                                volume: targetVolume,
                                                duration: 750
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                } catch (e) {
                    console.warn('OP音乐播放失败:', e);
                }
            }
        });
        
        // v1.1.3: 保存所有元素引用以便销毁
        this.welcomePopupElements = [overlay, panelBg, panelBorder, btnStart, btnMimic, tTitle, tWelcome, tDesc1, tDesc2, tStart, tMimic, logoImg];
    }
    
    createPreviewBadge() {
        if (this.previewBadge) this.previewBadge.destroy();
        const level = gameState.nextBadgeLevel;
        const variant = gameState.selectedVariant[level];
        const key = `b_${level}_${variant}`;
        const config = BADGE_LEVELS[level - 1];
        this.previewBadge = this.add.image(px(GAME_WIDTH / 2), px(PREVIEW_Y), key);
        this.previewBadge.setDisplaySize(px(config.radius * 2), px(config.radius * 2));
        this.previewBadge.setOrigin(0.5);
        this.previewBadge.setDepth(50);
        this.previewBadge.setAlpha(0);
        this.tweens.add({
            targets: this.previewBadge,
            alpha: 1,
            duration: 200,
            ease: 'Quad.easeOut'
        });
    }
    
    updatePreviewBadge() {
        if (!this.previewBadge || !this.previewBadge.active) return;
        const level = gameState.nextBadgeLevel;
        const variant = gameState.selectedVariant[level];
        const key = `b_${level}_${variant}`;
        const config = BADGE_LEVELS[level - 1];
        this.previewBadge.setTexture(key);
        this.previewBadge.setDisplaySize(px(config.radius * 2), px(config.radius * 2));
        this.previewBadge.setAlpha(0);
        this.tweens.add({
            targets: this.previewBadge,
            alpha: 1,
            duration: 200,
            ease: 'Quad.easeOut'
        });
    }

    updateBackground() {
        // 清除旧背景
        if (this.background) {
            this.background.destroy();
        }
        
        // 创建新背景（v1.0.8: 物理像素）
        const W = px(GAME_WIDTH), H = px(GAME_HEIGHT);
        if (gameState.currentTheme === 'day') {
            // 昼间：双色渐变 #F8D5D2 和 #A4B4C4
            this.background = this.add.graphics();
            this.background.fillGradientStyle(0xF8D5D2, 0xF8D5D2, 0xA4B4C4, 0xA4B4C4, 1);
            this.background.fillRect(0, 0, W, H);
        } else {
            // 夜间：深色渐变
            this.background = this.add.graphics();
            this.background.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
            this.background.fillRect(0, 0, W, H);
        }
        
        // 确保背景在最底层
        this.background.setDepth(-1);
    }

    updateKillLine() {
        this.killLine.clear();
        const lineColor = gameState.currentTheme === 'day' ? 0xff0000 : 0xff6666;
        this.killLine.lineStyle(px(4), lineColor, 1);
        this.killLine.lineBetween(0, px(KILL_LINE_Y), px(GAME_WIDTH), px(KILL_LINE_Y));
    }

    setupInput() {
        this.input.on('pointerdown', (pointer) => {
            // v1.1.2: POPUP显示时阻止投放
            // v1.1.3: 设置面板打开时也阻止投放
            if (gameState.showWelcomePopup || this.settingsPanel || gameState.gameOver || gameState.isDropping) return;
            const tx = px(GAME_WIDTH - 50), ty = px(50), tw = px(80), th = px(40);
            // v1.1.2: 排除设置按钮区域
            // 使用与createUI中相同的计算方式
            const themeX = px(GAME_WIDTH - 50);
            const themeRadius = px(24);
            const settingsRadius = px(24);
            const settingsX = themeX - themeRadius - settingsRadius - px(10); // 与createUI中保持一致，往左移动10px
            const settingsY = px(50), settingsW = px(40), settingsH = px(40);
            if (pointer.x >= tx - tw / 2 && pointer.x <= tx + tw / 2 && pointer.y >= ty - th / 2 && pointer.y <= ty + th / 2) return;
            if (pointer.x >= settingsX - settingsW / 2 && pointer.x <= settingsX + settingsW / 2 && pointer.y >= settingsY - settingsH / 2 && pointer.y <= settingsY + settingsH / 2) return;
            this.dropBadge(pointer.x, pointer.y);
        });
    }

    setupCollision() {
        // 使用 Matter.js 的碰撞事件
        this.matter.world.on('collisionstart', (event) => {
            // v1.1.2: POPUP显示时阻止碰撞检测
            if (gameState.showWelcomePopup || gameState.gameOver) return;
            
            event.pairs.forEach(pair => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                
                // 获取游戏对象
                const objA = bodyA.gameObject;
                const objB = bodyB.gameObject;
                
                if (!objA || !objB) return;
                if (!objA.active || !objB.active) return;
                
                // 检查是否是吧唧
                if (!objA.getData || !objB.getData) return;
                const levelA = objA.getData('level');
                const levelB = objB.getData('level');
                
                if (levelA === undefined || levelB === undefined) return;
                
                // 如果等级相同且不是最高等级，触发合并
                if (levelA === levelB && levelA < 11) {
                    // 防止重复合并
                    const idA = objA.getData('id');
                    const idB = objB.getData('id');
                    const mergeKey = `${Math.min(idA, idB)}_${Math.max(idA, idB)}`;
                    
                    if (this.mergingBadges.has(mergeKey)) return;
                    this.mergingBadges.add(mergeKey);
                    
                    // 延迟清除合并标记，防止卡顿（v1.1.0: 间隔减少到1/3）
                    this.time.delayedCall(33, () => {
                        this.mergingBadges.delete(mergeKey);
                    });
                    
                    // 执行合并：A掉到B上，B升级，A消失
                    this.performMerge(objA, objB);
                }
            });
        });
    }

    dropBadge(targX, targY) {
        // v1.1.2: POPUP显示时阻止投放
        // v1.1.3: 设置面板打开时也阻止投放
        if (gameState.showWelcomePopup || this.settingsPanel || gameState.isDropping) return;
        
        gameState.isDropping = true;
        gameState.totalDrops += 1;
        // v1.1.1: 更新"您已读博"显示（添加"个"）
        if (this.dropsText) this.dropsText.setText(`您已读博: ${gameState.totalDrops}个`);
        const level = gameState.nextBadgeLevel;
        gameState.nextBadgeLevel = this.calculateNextBadgeLevel();
        this.updatePreviewBadge();
        
        const variant = gameState.selectedVariant[level];
        const key = `b_${level}_${variant}`;
        const config = BADGE_LEVELS[level - 1];
        const previewX = this.previewBadge ? this.previewBadge.x : px(GAME_WIDTH / 2);
        const safeX = Math.max(px(config.radius), Math.min(px(GAME_WIDTH - config.radius), targX));
        
        const mover = this.add.image(previewX, px(PREVIEW_Y), key);
        mover.setDisplaySize(px(config.radius * 2), px(config.radius * 2));
        mover.setOrigin(0.5);
        mover.setDepth(60);
        
        this.tweens.add({
            targets: mover,
            x: safeX,
            duration: 180,
            ease: 'Quad.easeOut',
            onComplete: () => {
                mover.destroy();
                this.createBadge(safeX, px(PREVIEW_Y), level);
                this.time.delayedCall(300, () => {
                    gameState.isDropping = false;
                });
            }
        });
    }

    createBadge(x, y, level) {
        const config = BADGE_LEVELS[level - 1];
        const variant = gameState.selectedVariant[level];
        const key = `b_${level}_${variant}`;
        
        // 确保坐标有效（v1.0.8: 物理像素）
        const safeX = isNaN(x) ? px(GAME_WIDTH / 2) : Math.max(px(config.radius), Math.min(px(GAME_WIDTH - config.radius), x));
        const safeY = isNaN(y) ? px(KILL_LINE_Y - 50) : Math.max(px(config.radius), y);
        
        // 创建物理图片对象
        const badge = this.matter.add.image(safeX, safeY, key, null, {
            shape: 'circle',
            radius: px(config.radius),
            restitution: 0.3, // 弹性
            friction: 0.1,    // 摩擦力
            frictionAir: 0.01  // 空气阻力
        });
        
        badge.setDisplaySize(px(config.radius * 2), px(config.radius * 2));
        
        // 确保吧唧显示在流星上方
        badge.setDepth(5);
        
        badge.setData('level', level);
        badge.setData('id', Phaser.Math.RND.uuid());
        badge.setData('isMerging', false);
        badge.setData('releaseTime', this.time.now); // 释放时间，用于 2 秒保护（Phaser 属性，非方法）
        
        // 添加到游戏状态
        gameState.badges.push(badge);
        
        return badge;
    }

    /**
     * 执行合并：A掉到B上，B升级，A消失
     * 判断逻辑：y坐标更大的（更下方的）作为B（被砸到的）
     */
    performMerge(objA, objB) {
        // 检查是否已经在合并中
        if (objA.getData('isMerging') || objB.getData('isMerging')) {
            return;
        }
        
        // v1.1.2: 消除时播放音效（带音量控制）
        try {
            if (this.cache.audio.exists && this.cache.audio.exists('merge')) {
                const sfx = this.sound.add('merge', { volume: gameState.sfxVolume });
                sfx.play();
            }
        } catch (e) {}
        
        const level = objA.getData('level');
        const nextLevel = level + 1;
        const nextConfig = BADGE_LEVELS[nextLevel - 1];
        
        // 判断A和B：y坐标更大的作为B（在下方，被砸到的）
        // 如果y相同，则用速度判断：速度更小的作为B（静止的）
        let badgeB, badgeA;
        
        if (objA.y > objB.y) {
            badgeB = objA;
            badgeA = objB;
        } else if (objB.y > objA.y) {
            badgeB = objB;
            badgeA = objA;
        } else {
            // y相同，用速度判断
            const speedA = Math.abs(objA.body.velocity.y);
            const speedB = Math.abs(objB.body.velocity.y);
            if (speedA > speedB) {
                badgeB = objB; // B静止，A掉落
                badgeA = objA;
            } else {
                badgeB = objA;
                badgeA = objB;
            }
        }
        
        badgeA.setData('isMerging', true);
        badgeB.setData('isMerging', true);
        
        const ax = badgeA.x, ay = badgeA.y;
        const badgeBX = badgeB.x;
        const badgeBY = badgeB.y;
        const velX = badgeB.body ? badgeB.body.velocity.x * 0.5 : 0;
        const velY = badgeB.body ? badgeB.body.velocity.y * 0.5 : 0;
        const midX = (ax + badgeBX) / 2;
        const midY = (ay + badgeBY) / 2;
        
        // 1. A 消失（仅淡出）
        this.tweens.add({
            targets: badgeA,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                gameState.badges = gameState.badges.filter(b => b !== badgeA);
                if (badgeA.body) this.matter.world.remove(badgeA.body);
                badgeA.destroy();
            }
        });
        
        // 2. 在 AB 之间显示 perfect.png 淡入淡出做遮挡，B 消失后替换成 B'（保留原始宽高比）
        const perfect = this.add.image(midX, midY, 'perfect');
        perfect.setDepth(200);
        perfect.setAlpha(0);
        const pw = perfect.width > 0 ? perfect.width : 80;
        const ph = perfect.height > 0 ? perfect.height : 80;
        const pmax = px(80);
        const scale = Math.min(pmax / pw, pmax / ph, 1);
        perfect.setDisplaySize(Math.round(pw * scale), Math.round(ph * scale));
        perfect.setOrigin(0.5);
        
        this.tweens.add({
            targets: perfect,
            alpha: 0.9,
            duration: 80,
            onComplete: () => {
                gameState.badges = gameState.badges.filter(b => b !== badgeB);
                if (badgeB.body) this.matter.world.remove(badgeB.body);
                badgeB.destroy();
                
                this.tweens.add({
                    targets: perfect,
                    alpha: 0,
                    duration: 150,
                    onComplete: () => {
                        perfect.destroy();
                        const newBadge = this.createBadge(badgeBX, badgeBY, nextLevel);
                        if (newBadge.body) newBadge.setVelocity(velX, velY);
                        gameState.totalMerges += 1;
                        // v1.1.1: 合计市价改为场上所有吧唧的分数总和，在 update 中计算，这里不更新
                        // 注意：totalDrops 只在 dropBadge 时增加，合并不增加，所以这里不更新 dropsText
                        if (nextLevel === 11) {
                            gameState.hasWon = true;
                            this.time.delayedCall(300, () => this.showWinPopup());
                        }
                    }
                });
            }
        });
    }

    update() {
        if (gameState.gameOver) return;
        
        // v1.1.1: 计算场上所有吧唧的分数总和（合计市价）
        let currentScore = 0;
        for (const badge of gameState.badges) {
            if (!badge.active) continue;
            const level = badge.getData('level');
            if (level !== undefined) {
                const config = BADGE_LEVELS[level - 1];
                if (config) currentScore += config.score;
            }
        }
        if (this.scoreText) {
            this.scoreText.setText(`合计市价: $${currentScore.toLocaleString()}`);
        }
        
        // v1.1.2: 检查背景音乐（如果当前音乐播放完毕，播放下一首）
        if (!gameState.showWelcomePopup && this.currentBgm && !this.currentBgm.isPlaying) {
            this.playNextBackgroundMusic();
        }
        
        // v1.1.6: 更新流星效果
        this.updateMeteors();
        
        // 检查斩杀线
        this.checkKillLine();
    }
    
    /**
     * v1.1.6: 更新流星效果（从右上到左下，带粉色和黄色尾巴）
     */
    updateMeteors() {
        const delta = this.game.loop.delta;
        this.meteorTimer += delta;
        
        // v1.1.7: 生成新流星（每2秒生成1~4个，数量减少30%）
        if (this.meteorTimer >= this.meteorInterval) {
            this.meteorTimer = 0;
            const count = Phaser.Math.Between(1, 4); // 随机生成1~4个（减少30%，从2~6改为1~4）
            for (let i = 0; i < count; i++) {
                // 稍微延迟每个流星的生成时间，避免完全重叠
                this.time.delayedCall(i * 100, () => {
                    this.createMeteor();
                });
            }
        }
        
        // 更新现有流星
        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const meteor = this.meteors[i];
            // 安全检查：确保meteor和emoji对象存在
            if (!meteor || !meteor.emoji) {
                if (meteor && meteor.trail) meteor.trail.destroy();
                this.meteors.splice(i, 1);
                continue;
            }
            
            // 检查emoji是否仍然有效
            if (!meteor.emoji.active || !meteor.emoji.scene) {
                if (meteor.trail) meteor.trail.destroy();
                if (meteor.emoji) meteor.emoji.destroy();
                this.meteors.splice(i, 1);
                continue;
            }
            
            // 移动流星
            const newX = meteor.emoji.x + meteor.vx * delta / 16;
            const newY = meteor.emoji.y + meteor.vy * delta / 16;
            meteor.emoji.x = newX;
            meteor.emoji.y = newY;
            
            // 记录位置用于尾巴
            meteor.trailPositions.push({ x: newX, y: newY });
            // 只保留最近的位置（尾巴长度）
            const maxTrailLength = 20;
            if (meteor.trailPositions.length > maxTrailLength) {
                meteor.trailPositions.shift();
            }
            
            // 绘制尾巴（粉色和黄色渐变）
            if (meteor.trail && meteor.trailPositions.length > 1) {
                meteor.trail.clear();
                const trailLength = meteor.trailPositions.length;
                for (let j = 0; j < trailLength - 1; j++) {
                    const pos1 = meteor.trailPositions[j];
                    const pos2 = meteor.trailPositions[j + 1];
                    const progress = j / trailLength;
                    const alpha = progress * 0.8; // 从透明到不透明
                    const color = progress < 0.5 ? 0xFFB6C1 : 0xFFD700; // 前半段粉色，后半段黄色
                    const width = px(3) * (1 - progress);
                    
                    meteor.trail.lineStyle(width, color, alpha);
                    meteor.trail.beginPath();
                    meteor.trail.moveTo(pos1.x, pos1.y);
                    meteor.trail.lineTo(pos2.x, pos2.y);
                    meteor.trail.strokePath();
                }
            }
            
            // 移除超出屏幕的流星
            if (meteor.emoji.x < -px(50) || meteor.emoji.y > px(GAME_HEIGHT + 50)) {
                if (meteor.emoji) meteor.emoji.destroy();
                if (meteor.trail) meteor.trail.destroy();
                this.meteors.splice(i, 1);
            }
        }
    }
    
    /**
     * v1.1.6: 创建一个流星
     * v1.1.7: 从右上方随机坐标开始，加速5倍
     * 混入Mimic谷店logo
     */
    createMeteor() {
        // 随机选择emoji或图片（混入Mimic谷店logo）
        // 5%概率使用logo
        const useImage = Math.random() < 0.05;
        let meteorObject;
        
        // v1.1.7: 从右上方随机坐标开始（营造胡乱划过的效果）
        // 起点范围：右上角区域（方差收紧20%：GAME_WIDTH的32%~88%，高度的-18%~38%）
        // 原范围：0.2~1.0 (0.8范围)，收紧20%后：0.32~0.88 (0.56范围)
        // 原范围：-0.3~0.5 (0.8范围)，收紧20%后：-0.18~0.38 (0.56范围)
        const startX = px(GAME_WIDTH * (0.32 + Math.random() * 0.56) + 50);
        const startY = px(GAME_HEIGHT * (-0.18 + Math.random() * 0.56) - 50);
        
        // v1.1.7: 终点也随机化（左下方区域，方差收紧20%），营造胡乱划过的效果
        // 原范围：-0.3~0.3 (0.6范围)，收紧20%后：-0.18~0.18 (0.36范围)
        // 原范围：0.4~1.0 (0.6范围)，收紧20%后：0.52~0.88 (0.36范围)
        const endX = px(GAME_WIDTH * (-0.18 + Math.random() * 0.36) - 50);
        const endY = px(GAME_HEIGHT * (0.52 + Math.random() * 0.36) + 50);
        
        // 计算方向和速度
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 防止除以0错误（如果起点和终点相同）
        if (distance === 0) {
            return; // 跳过这个流星
        }
        
        const speed = px(3.0); // 速度翻倍（从1.5改为3.0）
        const vx = (dx / distance) * speed;
        const vy = (dy / distance) * speed;
        
        // 安全地检查和使用Mimic图片
        try {
            // 检查图片是否已加载（使用更直接的方式）
            const hasMimicImage = this.textures && this.textures.exists('mimic');
            
            if (useImage && hasMimicImage) {
                // 使用Mimic谷店logo图片
                const logoSize = px(30);
                meteorObject = this.add.image(startX, startY, 'mimic');
                if (meteorObject) {
                    meteorObject.setDisplaySize(logoSize, logoSize);
                    meteorObject.setOrigin(0.5);
                }
            }
            
            // 如果图片创建失败或未使用图片，使用emoji（70%透明度）
            if (!meteorObject) {
                const emoji = Phaser.Utils.Array.GetRandom(this.meteorEmojis);
                meteorObject = this.add.text(startX, startY, emoji, {
                    fontSize: fs(24),
                    fill: '#fff',
                    fontFamily: 'Arial',
                    alpha: 0.7 // 70%透明度
                }).setOrigin(0.5);
            }
        } catch (e) {
            // 如果图片加载失败，回退到emoji（70%透明度）
            console.warn('Failed to create meteor with image, using emoji instead:', e);
            const emoji = Phaser.Utils.Array.GetRandom(this.meteorEmojis);
            meteorObject = this.add.text(startX, startY, emoji, {
                fontSize: fs(24),
                fill: '#fff',
                fontFamily: 'Arial',
                alpha: 0.7 // 70%透明度
            }).setOrigin(0.5);
        }
        
        // 确保meteorObject已创建
        if (!meteorObject) {
            return; // 如果创建失败，跳过
        }
        
        // 设置深度（在背景上方但在吧唧和icon后面）
        meteorObject.setDepth(-0.5);
        
        // 创建尾巴（使用图形，每帧更新）
        const trail = this.add.graphics();
        trail.setDepth(-0.5); // 与emoji相同的深度
        
        // 保存历史位置用于绘制尾巴
        const trailPositions = [{ x: startX, y: startY }];
        
        this.meteors.push({
            emoji: meteorObject,
            trail: trail,
            trailPositions: trailPositions,
            vx: vx,
            vy: vy,
            lastUpdate: this.time.now
        });
    }
    
    /**
     * v1.1.2: 开始背景音乐（随机播放，不重复）
     */
    startBackgroundMusic() {
        if (this.bgmList.length === 0) return;
        this.currentBgmIndex = Phaser.Math.Between(0, this.bgmList.length - 1);
        this.playNextBackgroundMusic();
    }
    
    /**
     * v1.1.2: 播放下一首背景音乐（随机选择，不重复上一首）
     */
    playNextBackgroundMusic() {
        if (this.bgmList.length === 0) return;
        
        // 如果只有一首，直接播放
        if (this.bgmList.length === 1) {
            const key = this.bgmList[0];
            if (this.cache.audio.exists(key)) {
                if (this.currentBgm) this.currentBgm.stop();
                this.currentBgm = this.sound.add(key, { volume: 0, loop: false });
                this.currentBgm.play();
                this.tweens.add({
                    targets: this.currentBgm,
                    volume: gameState.bgmVolume,
                    duration: 2000
                });
                this.currentBgm.on('complete', () => {
                    this.playNextBackgroundMusic();
                });
            }
            return;
        }
        
        // 随机选择下一首（不重复上一首）
        let nextIndex;
        do {
            nextIndex = Phaser.Math.Between(0, this.bgmList.length - 1);
        } while (nextIndex === this.currentBgmIndex && this.bgmList.length > 1);
        
        this.currentBgmIndex = nextIndex;
        const key = this.bgmList[this.currentBgmIndex];
        
        if (this.cache.audio.exists(key)) {
            // 淡出当前音乐（3秒渐出）
            if (this.currentBgm && this.currentBgm.isPlaying) {
                this.tweens.add({
                    targets: this.currentBgm,
                    volume: 0,
                    duration: 3000,
                    onComplete: () => {
                        if (this.currentBgm) this.currentBgm.stop();
                        this.playBgmWithFade(key);
                    }
                });
            } else {
                this.playBgmWithFade(key);
            }
        }
    }
    
    /**
     * v1.1.2: 播放背景音乐（带渐入）
     * 修改：3秒渐入，分4个阶段（10% -> 40% -> 70% -> 100%）
     */
    playBgmWithFade(key) {
        if (this.currentBgm) this.currentBgm.stop();
        this.currentBgm = this.sound.add(key, { volume: 0, loop: false });
        this.currentBgm.play();
        
        // 3秒渐入，分4个阶段：第一秒10%，第二秒40%，第三秒70%，第四秒100%
        const targetVolume = gameState.bgmVolume;
        this.currentBgm.setVolume(0);
        
        // 第一阶段：0 -> 10% (0-0.75秒)
        this.tweens.add({
            targets: this.currentBgm,
            volume: targetVolume * 0.1,
            duration: 750,
            onComplete: () => {
                // 第二阶段：10% -> 40% (0.75-1.5秒)
                this.tweens.add({
                    targets: this.currentBgm,
                    volume: targetVolume * 0.4,
                    duration: 750,
                    onComplete: () => {
                        // 第三阶段：40% -> 70% (1.5-2.25秒)
                        this.tweens.add({
                            targets: this.currentBgm,
                            volume: targetVolume * 0.7,
                            duration: 750,
                            onComplete: () => {
                                // 第四阶段：70% -> 100% (2.25-3秒)
                                this.tweens.add({
                                    targets: this.currentBgm,
                                    volume: targetVolume,
                                    duration: 750
                                });
                            }
                        });
                    }
                });
            }
        });
        
        this.currentBgm.on('complete', () => {
            this.playNextBackgroundMusic();
        });
    }
    
    /**
     * v1.1.2: 显示设置面板
     */
    showSettingsPanel() {
        const cx = px(GAME_WIDTH / 2);
        const cy = px(GAME_HEIGHT / 2);
        const MIMIC_URL = 'https://www.xiaohongshu.com/user/profile/64620111000000002a00b1ab?xsec_token=YBW46oIJMPlwXdn-p_dC82jR5R1LhesqZNoZiksdd53SA=&xsec_source=app_share&xhsshare=CopyLink&shareRedId=ODpDQTM-PUE2NzUyOTgwNjczOThKOjY-&apptime=1769156949&share_id=e626a77e05c44cccb0cb838d8148d677';
        
        // 背景遮罩
        const overlay = this.add.rectangle(cx, cy, px(GAME_WIDTH), px(GAME_HEIGHT), 0x000000, 0.6).setDepth(400).setInteractive();
        
        // 主面板
        const panelW = px(Math.min(GAME_WIDTH * 0.8, 400));
        const panelH = px(450);
        const panelBg = this.add.rectangle(cx, cy, panelW, panelH, 0xF8D5D2, 0.95).setDepth(401);
        const panelBorder = this.add.rectangle(cx, cy, panelW, panelH, 0xA4B4C4, 0).setDepth(401).setStrokeStyle(px(3), 0xFFB6C1, 1);
        
        let y = cy - panelH / 2 + px(40);
        
        // 标题
        const tTitle = this.add.text(cx, y, '设置', {
            fontSize: fs(26),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#A4B4C4',
            strokeThickness: px(2)
        }).setOrigin(0.5).setDepth(402);
        y += px(60);
        
        // 背景音乐音量（v1.1.3: 保存文本引用以便销毁）
        const tBgmLabel = this.add.text(cx - px(80), y, '背景音乐', {
            fontSize: fs(18),
            fill: '#666',
            fontFamily: 'Arial'
        }).setOrigin(1, 0.5).setDepth(402);
        const bgmSlider = this.add.rectangle(cx + px(20), y, px(120), px(6), 0xA4B4C4, 1).setDepth(402);
        const bgmHandle = this.add.circle(cx + px(20) + (gameState.bgmVolume - 0.5) * px(120), y, px(12), 0xFFB6C1, 1)
            .setInteractive({ draggable: true, useHandCursor: true }).setDepth(403)
            .on('drag', (pointer, dragX) => {
                const minX = bgmSlider.x - bgmSlider.width / 2;
                const maxX = bgmSlider.x + bgmSlider.width / 2;
                const newX = Phaser.Math.Clamp(dragX, minX, maxX);
                bgmHandle.x = newX;
                gameState.bgmVolume = (newX - minX) / bgmSlider.width;
                if (this.currentBgm) this.currentBgm.setVolume(gameState.bgmVolume);
            });
        y += px(50);
        
        // 音效音量（v1.1.3: 保存文本引用以便销毁）
        const tSfxLabel = this.add.text(cx - px(80), y, '音效', {
            fontSize: fs(18),
            fill: '#666',
            fontFamily: 'Arial'
        }).setOrigin(1, 0.5).setDepth(402);
        const sfxSlider = this.add.rectangle(cx + px(20), y, px(120), px(6), 0xA4B4C4, 1).setDepth(402);
        const sfxHandle = this.add.circle(cx + px(20) + (gameState.sfxVolume - 0.5) * px(120), y, px(12), 0xFFB6C1, 1)
            .setInteractive({ draggable: true, useHandCursor: true }).setDepth(403)
            .on('drag', (pointer, dragX) => {
                const minX = sfxSlider.x - sfxSlider.width / 2;
                const maxX = sfxSlider.x + sfxSlider.width / 2;
                const newX = Phaser.Math.Clamp(dragX, minX, maxX);
                sfxHandle.x = newX;
                gameState.sfxVolume = (newX - minX) / sfxSlider.width;
            });
        y += px(60);
        
        // 关注Mimic谷店按钮（v1.1.4: iOS兼容跳转，使用网页链接）
        const btnMimic = this.add.rectangle(cx, y, px(200), px(44), 0xA4B4C4, 1)
            .setInteractive({ useHandCursor: true }).setDepth(402)
            .setStrokeStyle(px(2), 0xFFB6C1, 1)
            .on('pointerdown', () => {
                // v1.1.4: 使用网页链接跳转（iOS兼容）
                window.location.href = MIMIC_URL;
            })
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const tMimic = this.add.text(cx, y, '关注Mimic谷店', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(403);
        y += px(60);
        
        // 关闭按钮
        const btnClose = this.add.rectangle(cx, y, px(150), px(40), 0xFFB6C1, 1)
            .setInteractive({ useHandCursor: true }).setDepth(402)
            .setStrokeStyle(px(2), 0xFFC0CB, 1)
            .on('pointerdown', () => {
                this.closeSettingsPanel();
            })
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const tClose = this.add.text(cx, y, '关闭', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(403);
        
        // v1.1.3: 保存面板元素引用（包括所有文本标签）
        this.settingsPanel = {
            overlay, panelBg, panelBorder, tTitle, 
            tBgmLabel, bgmSlider, bgmHandle, 
            tSfxLabel, sfxSlider, sfxHandle,
            btnMimic, tMimic, btnClose, tClose
        };
    }
    
    /**
     * v1.1.2: 关闭设置面板
     */
    closeSettingsPanel() {
        if (!this.settingsPanel) return;
        // v1.1.3: 销毁所有元素，包括文本标签
        const elements = [
            this.settingsPanel.overlay, this.settingsPanel.panelBg, this.settingsPanel.panelBorder,
            this.settingsPanel.tTitle, 
            this.settingsPanel.tBgmLabel, this.settingsPanel.bgmSlider, this.settingsPanel.bgmHandle,
            this.settingsPanel.tSfxLabel, this.settingsPanel.sfxSlider, this.settingsPanel.sfxHandle,
            this.settingsPanel.btnMimic, this.settingsPanel.tMimic,
            this.settingsPanel.btnClose, this.settingsPanel.tClose
        ];
        elements.forEach(el => { if (el && el.destroy) el.destroy(); });
        this.settingsPanel = null;
    }

    /**
     * 检查斩杀线（v1.0.6）
     * - 新吧唧释放后 2 秒保护期内不触发斩杀线。
     * - 任意吧唧的顶部越过斩杀线即触发 10 秒倒计时；倒计时归零则失败。
     * - 触发时显示斩杀线并闪烁；未触发时隐藏斩杀线。
     */
    checkKillLine() {
        const now = this.time.now;
        let anyAbove = false;
        
        for (const badge of gameState.badges) {
            if (!badge.active) continue;
            if (badge.getData('isMerging')) continue;
            if (!badge.body) continue;
            
            const level = badge.getData('level');
            if (level === undefined) continue;
            const config = BADGE_LEVELS[level - 1];
            const radius = config ? px(config.radius) : px(20);
            
            const releaseTime = badge.getData('releaseTime');
            if (releaseTime !== undefined && (now - releaseTime) < KILL_PROTECTION_MS) continue;
            
            const topY = badge.y - radius;
            if (topY < px(KILL_LINE_Y)) {
                anyAbove = true;
                break;
            }
        }
        
        if (anyAbove) {
            // 触发斩杀线：显示并闪烁
            if (!this.killLine) {
                this.killLine = this.add.graphics();
                this.updateKillLine();
                this.killLine.setDepth(100);
            }
            
            // 闪烁动画（如果还没有启动）
            if (!this.killLineBlinkTween || !this.killLineBlinkTween.isActive()) {
                this.killLineBlinkTween = this.tweens.add({
                    targets: this.killLine,
                    alpha: { from: 1, to: 0.3 },
                    duration: 200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
            
            this.overKillLineTime += this.game.loop.delta;
            if (this.overKillLineTime >= KILL_COUNTDOWN_MS) this.endGame(false);
        } else {
            // 未触发：隐藏斩杀线
            if (this.killLine) {
                if (this.killLineBlinkTween) {
                    this.killLineBlinkTween.stop();
                    this.killLineBlinkTween = null;
                }
                this.killLine.destroy();
                this.killLine = null;
            }
            this.overKillLineTime = 0;
        }
    }

    /**
     * v1.1.8: 胜利弹窗：合成 11 级后询问「结束游戏」或「继续游戏」
     * 设计统一：与开始游戏、结算画面POPUP的设计一致（粉红色和浅蓝色主题）
     */
    showWinPopup() {
        const cx = px(GAME_WIDTH / 2);
        const cy = px(GAME_HEIGHT / 2);
        
        // v1.1.8: 背景遮罩（与开始游戏、结算画面一致）
        const overlay = this.add.rectangle(cx, cy, px(GAME_WIDTH), px(GAME_HEIGHT), 0x000000, 0.7).setDepth(200).setInteractive();
        
        // v1.1.8: 主面板（粉红色和浅蓝色主题，与开始游戏、结算画面一致）
        const panelW = px(Math.min(GAME_WIDTH * 0.88, 500));
        const panelH = px(450);
        const panelBg = this.add.rectangle(cx, cy, panelW, panelH, 0xF8D5D2, 0.95).setDepth(201);
        const panelBorder = this.add.rectangle(cx, cy, panelW, panelH, 0xA4B4C4, 0).setDepth(201).setStrokeStyle(px(4), 0xFFB6C1, 1);
        
        let y = cy - panelH / 2 + px(40);
        
        // v1.1.8: 标题（与开始游戏、结算画面一致）
        const tTitle = this.add.text(cx, y, '🎉 恭喜合成糕特！', {
            fontSize: fs(28),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#A4B4C4',
            strokeThickness: px(2)
        }).setOrigin(0.5).setDepth(202);
        y += px(50);
        
        // v1.1.8: 副标题（与开始游戏、结算画面一致）
        const tSub = this.add.text(cx, y, '是否结束游戏？', {
            fontSize: fs(18),
            fill: '#666',
            fontFamily: 'Arial'
        }).setOrigin(0.5, 0).setDepth(202).setWordWrapWidth(panelW - px(60));
        y += tSub.height + px(50);
        
        // v1.1.8: 按钮组（与开始游戏、结算画面一致）
        const btnW = px(200);
        const btnH = px(44);
        const btnSpacing = px(20);
        
        // v1.1.8: 结束游戏按钮（浅蓝色，与结算画面一致）
        const btnEnd = this.add.rectangle(cx, y, btnW, btnH, 0xA4B4C4, 1)
            .setInteractive({ useHandCursor: true }).setDepth(202)
            .setStrokeStyle(px(2), 0xFFB6C1, 1)
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const t1 = this.add.text(cx, y, '结束游戏', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(203);
        y += btnH + btnSpacing;
        
        // v1.1.8: 继续游戏按钮（粉色，与结算画面一致）
        const btnGo = this.add.rectangle(cx, y, btnW, btnH, 0xFFB6C1, 1)
            .setInteractive({ useHandCursor: true }).setDepth(202)
            .setStrokeStyle(px(2), 0xFFC0CB, 1)
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const t2 = this.add.text(cx, y, '继续游戏', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(203);
        
        const winRefs = [overlay, panelBg, panelBorder, tTitle, tSub, btnEnd, btnGo, t1, t2];
        const closeWin = () => { winRefs.forEach(o => o && o.destroy && o.destroy()); };
        btnEnd.on('pointerdown', () => { closeWin(); this.endGame(true); });
        btnGo.on('pointerdown', () => { closeWin(); });
    }

    /**
     * v1.1.8: 结束游戏
     * 如果已合成糕特（hasWon），即使被斩杀线判定失败，也按成功处理
     */
    endGame(isWin) {
        if (gameState.gameOver) return;
        
        gameState.gameOver = true;
        
        // v1.1.8: 如果已合成糕特，即使被斩杀线判定失败，也按成功处理
        const finalIsWin = isWin || gameState.hasWon;
        
        // v1.1.2: 停止背景音乐（3秒渐出）
        if (this.currentBgm && this.currentBgm.isPlaying) {
            this.tweens.add({
                targets: this.currentBgm,
                volume: 0,
                duration: 3000,
                onComplete: () => {
                    if (this.currentBgm) this.currentBgm.stop();
                }
            });
        }
        
        gameState.badges.forEach(badge => {
            if (badge && badge.body) badge.setStatic(true);
        });
        
        // v1.1.5: 游戏结束时自动截图（在显示结算画面之前）
        const gameCanvas = this.game.canvas;
        if (gameCanvas) {
            try {
                this.gameScreenshot = gameCanvas.toDataURL('image/png');
            } catch (e) {
                console.warn('Failed to capture game screenshot at endGame:', e);
                this.gameScreenshot = null;
            }
        }
        
        this.time.delayedCall(500, () => {
            this.showResultScreen(finalIsWin);
        });
    }

    /**
     * v1.1.4: 结算页（重做，沿用开始游戏POPUP的设计思路）
     * 累计读博、合成次数、称号、关注Mimic谷店、生成图片、朕知道了
     */
    showResultScreen(isWin) {
        const cx = px(GAME_WIDTH / 2);
        const cy = px(GAME_HEIGHT / 2);
        const MIMIC_URL = 'https://www.xiaohongshu.com/user/profile/64620111000000002a00b1ab?xsec_token=YBW46oIJMPlwXdn-p_dC82jR5R1LhesqZNoZiksdd53SA=&xsec_source=app_share&xhsshare=CopyLink&shareRedId=ODpDQTM-PUE2NzUyOTgwNjczOThKOjY-&apptime=1769156949&share_id=e626a77e05c44cccb0cb838d8148d677';
        
        // v1.1.1: 计算场上所有吧唧的分数总和（合计市价）
        let finalScore = 0;
        for (const badge of gameState.badges) {
            if (!badge.active) continue;
            const level = badge.getData('level');
            if (level !== undefined) {
                const config = BADGE_LEVELS[level - 1];
                if (config) finalScore += config.score;
            }
        }
        const title = TITLES.find(t => finalScore >= t.min && finalScore < t.max) || TITLES[TITLES.length - 1];
        
        // 背景遮罩（v1.1.4: 沿用开始游戏POPUP的设计）
        const overlay = this.add.rectangle(cx, cy, px(GAME_WIDTH), px(GAME_HEIGHT), 0x000000, 0.7).setDepth(100).setInteractive();
        
        // 主面板（v1.1.4: 粉红色和浅蓝色主题，与开始游戏POPUP一致）
        const panelW = px(Math.min(GAME_WIDTH * 0.88, 500));
        const panelH = px(Math.min(GAME_HEIGHT * 0.8, 600));
        const panelBg = this.add.rectangle(cx, cy, panelW, panelH, 0xF8D5D2, 0.95).setDepth(101);
        const panelBorder = this.add.rectangle(cx, cy, panelW, panelH, 0xA4B4C4, 0).setDepth(101).setStrokeStyle(px(4), 0xFFB6C1, 1);
        
        let y = cy - panelH / 2 + px(40);
        
        // 标题（v1.1.4: 沿用开始游戏POPUP的样式）
        const tTitle = this.add.text(cx, y, isWin ? '🎉 恭喜合成糕特！' : '💔 游戏结束', {
            fontSize: fs(28),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#A4B4C4',
            strokeThickness: px(2)
        }).setOrigin(0.5).setDepth(102);
        y += px(50);
        
        // 副标题（v1.1.4: 沿用开始游戏POPUP的样式）
        // 向上15px（从px(35)改为px(20)）
        const tSubtitle = this.add.text(cx, y, isWin ? '你成功合成了最高等级吧唧！' : '你因囤积太多吧唧，被迫退坑跑路。', {
            fontSize: fs(18),
            fill: '#666',
            fontFamily: 'Arial'
        }).setOrigin(0.5, 0).setDepth(102).setWordWrapWidth(panelW - px(60));
        y += tSubtitle.height + (isWin ? px(30) : px(20)); // 向上15px（从px(35)改为px(20)）
        
        // 数据卡片（已删除背景框，只保留文字和数字）
        // 累计读博、合计市价以及他们的数字向上30px（从y+px(20)改为y-px(10)）
        y -= px(10); // 调整y位置（向上30px）
        
        const tDropsLabel = this.add.text(cx - px(60), y, '累计读博', { 
            fontSize: fs(16), 
            fill: '#666', 
            fontFamily: 'Arial' 
        }).setOrigin(0.5, 0).setDepth(102);
        // v1.1.5: 合成次数改成合计市价
        const tMergesLabel = this.add.text(cx + px(60), y, '合计市价', { 
            fontSize: fs(16), 
            fill: '#666', 
            fontFamily: 'Arial' 
        }).setOrigin(0.5, 0).setDepth(102);
        y += px(30);
        const tDrops = this.add.text(cx - px(60), y, `${gameState.totalDrops}`, { 
            fontSize: fs(32), 
            fill: '#fff', 
            fontFamily: 'Arial', 
            fontStyle: 'bold',
            stroke: '#A4B4C4',
            strokeThickness: px(1)
        }).setOrigin(0.5, 0).setDepth(102);
        // v1.1.5: 显示合计市价（和游戏界面逻辑一样，场上所有吧唧的分数总和）
        const tMerges = this.add.text(cx + px(60), y, `$${finalScore.toLocaleString()}`, { 
            fontSize: fs(32), 
            fill: '#fff', 
            fontFamily: 'Arial', 
            fontStyle: 'bold',
            stroke: '#A4B4C4',
            strokeThickness: px(1)
        }).setOrigin(0.5, 0).setDepth(102);
        y += px(50);
        
        // 称号（v1.1.4: 沿用开始游戏POPUP的样式）
        // v1.1.5: 称号向下40px（相对于向上20px后的位置，实际是y+px(20)）
        const tTitleName = this.add.text(cx, y + px(20), `称号：${title.name}`, { 
            fontSize: fs(22), 
            fill: '#fff', 
            fontFamily: 'Arial', 
            fontStyle: 'bold',
            stroke: '#A4B4C4',
            strokeThickness: px(2)
        }).setOrigin(0.5).setDepth(102);
        y += px(70); // 调整间距（从px(90)改为px(70)，因为称号已经向上20px了）
        
        // 按钮组（v1.1.4: 使用粉红色和浅蓝色主题）
        // v1.1.5: 三个按钮向上20px（移除之前的y += px(40)）
        const btnW = px(200);
        const btnH = px(44);
        const btnSpacing = px(20);
        
        // 关注Mimic谷店按钮（v1.1.4: 粉色，iOS兼容跳转，使用网页链接）
        const btnMimic = this.add.rectangle(cx, y, btnW, btnH, 0xFFB6C1, 1)
            .setInteractive({ useHandCursor: true }).setDepth(102)
            .setStrokeStyle(px(2), 0xFFC0CB, 1)
            .on('pointerdown', () => {
                // v1.1.4: 使用网页链接跳转（iOS兼容）
                window.location.href = MIMIC_URL;
            })
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const tMimic = this.add.text(cx, y, '关注Mimic谷店小红书', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(103);
        y += btnH + btnSpacing;
        
        // 隐藏此页按钮（v1.1.4: 浅蓝色，点击后隐藏结算页，显示恢复按钮）
        const btnPic = this.add.rectangle(cx, y, btnW, btnH, 0xA4B4C4, 1)
            .setInteractive({ useHandCursor: true }).setDepth(102)
            .setStrokeStyle(px(2), 0xFFB6C1, 1)
            .on('pointerdown', () => {
                // 隐藏结算页面的所有元素
                const resultElements = this.resultScreenElements || [];
                resultElements.forEach(el => {
                    if (el && el.setVisible) {
                        el.setVisible(false);
                    }
                });
                // v1.1.6: 在画面最下方显示恢复按钮
                if (!this.btnRestore) {
                    const restoreY = px(GAME_HEIGHT - 60); // 画面最下方
                    this.btnRestore = this.add.rectangle(cx, restoreY, btnW, btnH, 0xFFB6C1, 1)
                        .setInteractive({ useHandCursor: true }).setDepth(200)
                        .setStrokeStyle(px(3), 0xA4B4C4, 1) // v1.1.6: 浅蓝色边框
                        .on('pointerdown', () => {
                            // 恢复结算页面的所有元素
                            resultElements.forEach(el => {
                                if (el && el.setVisible) {
                                    el.setVisible(true);
                                }
                            });
                            // 隐藏恢复按钮和文字
                            if (this.btnRestore) {
                                this.btnRestore.setVisible(false);
                            }
                            if (this.tRestore) {
                                this.tRestore.setVisible(false);
                            }
                        })
                        .on('pointerover', function() { this.setScale(1.05); })
                        .on('pointerout', function() { this.setScale(1); });
                    this.tRestore = this.add.text(cx, restoreY, '恢复结算页', {
                        fontSize: fs(16),
                        fill: '#fff',
                        fontFamily: 'Arial',
                        fontStyle: 'bold'
                    }).setOrigin(0.5).setDepth(201);
                } else {
                    this.btnRestore.setVisible(true);
                    if (this.tRestore) this.tRestore.setVisible(true);
                }
            })
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const tPic = this.add.text(cx, y, '隐藏此页', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(103);
        y += btnH + btnSpacing;
        
        // 朕知道了按钮（v1.1.4: 浅蓝色）
        const btnKnow = this.add.rectangle(cx, y, btnW, btnH, 0xA4B4C4, 1)
            .setInteractive({ useHandCursor: true }).setDepth(102)
            .setStrokeStyle(px(2), 0xFFB6C1, 1)
            .on('pointerdown', () => { location.reload(); })
            .on('pointerover', function() { this.setScale(1.05); })
            .on('pointerout', function() { this.setScale(1); });
        const tKnow = this.add.text(cx, y, '朕知道了', {
            fontSize: fs(16),
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(103);
        
        // v1.1.4: 保存所有元素引用（如果需要后续销毁）
        // v1.1.5: 保存结算画面元素，用于隐藏/恢复功能（已删除cardBg背景框）
        this.resultScreenElements = [overlay, panelBg, panelBorder, tTitle, tSubtitle, 
            tDropsLabel, tMergesLabel, tDrops, tMerges, tTitleName,
            btnMimic, tMimic, btnPic, tPic, btnKnow, tKnow];
        
        // 初始化恢复按钮（初始隐藏）
        this.btnRestore = null;
        this.tRestore = null;
    }

    /**
     * v1.1.5: 生成小红书尺寸竖屏分享图，弹出引导长按保存
     * @param {Object} title - 称号对象
     * @param {number} finalScore - 最终分数（v1.1.1: 场上所有吧唧的分数总和）
     */
    generateShareImage(title, finalScore = 0) {
        const w = 600, h = 900;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        
        // 背景渐变
        const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
        bgGradient.addColorStop(0, '#F8D5D2');
        bgGradient.addColorStop(1, '#A4B4C4');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, w, h);
        
        // 标题
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PJSK 合成大海景', w / 2, 80);
        
        // 数据（v1.1.5: 更新为合计市价）
        ctx.font = '24px Arial';
        ctx.fillText(`累计读博：${gameState.totalDrops}  合计市价：$${finalScore.toLocaleString()}`, w / 2, 140);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`称号：${title.name}`, w / 2, 190);
        
        // 弹出窗口函数
        const drawPopup = (dataUrl) => {
            const d = document.createElement('div');
            d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
            if (dataUrl) {
                const im = document.createElement('img');
                im.src = dataUrl;
                im.style.maxWidth = '90vw'; im.style.maxHeight = '70vh'; im.style.borderRadius = '8px';
                d.appendChild(im);
            }
            const tip = document.createElement('p');
            tip.textContent = '长按图片保存';
            tip.style.color = '#fff'; tip.style.marginTop = '16px'; tip.style.fontSize = '18px';
            d.appendChild(tip);
            const btn = document.createElement('button');
            btn.textContent = '关闭';
            btn.style.marginTop = '12px'; btn.style.padding = '10px 24px'; btn.style.fontSize = '16px';
            btn.onclick = () => d.remove();
            d.appendChild(btn);
            document.body.appendChild(d);
        };
        
        // v1.1.5: 使用游戏结束时自动截图的缓存（如果存在）
        if (this.gameScreenshot) {
            const gameImg = new Image();
            gameImg.onload = () => {
                // v1.1.5: 放大游戏截图，使其足够看清
                const gameAspect = gameImg.width / gameImg.height;
                const targetW = w - 40; // 更大的宽度
                const targetH = 500; // 更大的高度（从400改为500）
                let drawW = targetW, drawH = targetW / gameAspect;
                if (drawH > targetH) {
                    drawH = targetH;
                    drawW = targetH * gameAspect;
                }
                const drawX = (w - drawW) / 2;
                const drawY = 240;
                
                ctx.drawImage(gameImg, drawX, drawY, drawW, drawH);
                
                // 文案（带换行）
                ctx.fillStyle = '#333';
                ctx.font = '18px Arial';
                ctx.textAlign = 'center';
                const text = `我刚在 PJSK 合成大西瓜里合出了「${title.name}」！身价高达 $${finalScore.toLocaleString()}！你也来试试手气？`;
                const maxWidth = w - 40;
                const lineHeight = 26;
                let y = drawY + drawH + 40;
                const words = text.split('');
                let line = '';
                for (let i = 0; i < words.length; i++) {
                    const testLine = line + words[i];
                    const metrics = ctx.measureText(testLine);
                    if (metrics.width > maxWidth && line.length > 0) {
                        ctx.fillText(line, w / 2, y);
                        line = words[i];
                        y += lineHeight;
                    } else {
                        line = testLine;
                    }
                }
                if (line.length > 0) {
                    ctx.fillText(line, w / 2, y);
                }
                
                ctx.fillStyle = '#666';
                ctx.font = '16px Arial';
                ctx.fillText('长按图片保存分享', w / 2, h - 60);
                
                drawPopup(canvas.toDataURL('image/png'));
            };
            gameImg.onerror = () => {
                drawPopup(canvas.toDataURL('image/png'));
            };
            gameImg.src = this.gameScreenshot;
        } else {
            // 如果没有缓存截图，回退到原来的方式（临时隐藏结算画面）
            const resultElements = this.resultScreenElements || [];
            const originalVisibilities = [];
            resultElements.forEach(el => {
                if (el && el.setVisible) {
                    originalVisibilities.push({ element: el, visible: el.visible });
                    el.setVisible(false);
                }
            });
            
            // 等待一帧确保隐藏完成
            this.time.delayedCall(50, () => {
                // 游戏截图（从 Phaser Canvas 获取）
                const gameCanvas = this.game.canvas;
                if (gameCanvas) {
                    try {
                        const gameImg = new Image();
                        gameImg.onload = () => {
                            // v1.1.5: 放大游戏截图，使其足够看清
                            const gameAspect = gameCanvas.width / gameCanvas.height;
                            const targetW = w - 40;
                            const targetH = 500;
                            let drawW = targetW, drawH = targetW / gameAspect;
                            if (drawH > targetH) {
                                drawH = targetH;
                                drawW = targetH * gameAspect;
                            }
                            const drawX = (w - drawW) / 2;
                            const drawY = 240;
                            
                            ctx.drawImage(gameImg, drawX, drawY, drawW, drawH);
                            
                            // 文案（带换行）
                            ctx.fillStyle = '#333';
                            ctx.font = '18px Arial';
                            ctx.textAlign = 'center';
                            const text = `我刚在 PJSK 合成大西瓜里合出了「${title.name}」！身价高达 $${finalScore.toLocaleString()}！你也来试试手气？`;
                            const maxWidth = w - 40;
                            const lineHeight = 26;
                            let y = drawY + drawH + 40;
                            const words = text.split('');
                            let line = '';
                            for (let i = 0; i < words.length; i++) {
                                const testLine = line + words[i];
                                const metrics = ctx.measureText(testLine);
                                if (metrics.width > maxWidth && line.length > 0) {
                                    ctx.fillText(line, w / 2, y);
                                    line = words[i];
                                    y += lineHeight;
                                } else {
                                    line = testLine;
                                }
                            }
                            if (line.length > 0) {
                                ctx.fillText(line, w / 2, y);
                            }
                            
                            ctx.fillStyle = '#666';
                            ctx.font = '16px Arial';
                            ctx.fillText('长按图片保存分享', w / 2, h - 60);
                            
                            // 恢复结算画面显示
                            originalVisibilities.forEach(({ element, visible }) => {
                                if (element && element.setVisible) {
                                    element.setVisible(visible);
                                }
                            });
                            
                            drawPopup(canvas.toDataURL('image/png'));
                        };
                        gameImg.onerror = () => {
                            // 恢复结算画面显示
                            originalVisibilities.forEach(({ element, visible }) => {
                                if (element && element.setVisible) {
                                    element.setVisible(visible);
                                }
                            });
                            drawPopup(canvas.toDataURL('image/png'));
                        };
                        gameImg.src = gameCanvas.toDataURL('image/png');
                    } catch (e) {
                        console.error('Failed to capture game screenshot:', e);
                        // 恢复结算画面显示
                        originalVisibilities.forEach(({ element, visible }) => {
                            if (element && element.setVisible) {
                                element.setVisible(visible);
                            }
                        });
                        drawPopup(canvas.toDataURL('image/png'));
                    }
                } else {
                    // 恢复结算画面显示
                    originalVisibilities.forEach(({ element, visible }) => {
                        if (element && element.setVisible) {
                            element.setVisible(visible);
                        }
                    });
                    drawPopup(canvas.toDataURL('image/png'));
                }
            });
        }
    }
}

// 游戏配置（v1.0.8: 高 DPR 提升 iOS 画质）
const config = {
    type: Phaser.AUTO,
    width: px(GAME_WIDTH),
    height: px(GAME_HEIGHT),
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 0.8 * DPR }, // v1.0.9: 重力按 DPR 同比调整
            debug: false
        }
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false
    },
    scene: [MainScene]
};

// 创建游戏实例
const game = new Phaser.Game(config);

// 窗口大小改变时重新调整
window.addEventListener('resize', () => {
    if (game && game.scale) {
        const newWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        const newHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        game.scale.resize(newWidth, newHeight);
    }
});
