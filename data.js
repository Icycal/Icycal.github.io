/* ============================================================================
 *  个人主页 · 内容配置（你以后只改这一个文件）
 *  ----------------------------------------------------------------------------
 *  · 改文字 / 加技能 / 加经历 / 加作品，全部在这里完成，不用碰 index.html。
 *  · 改完保存后：
 *      - Gitee Pages：回「服务 → Gitee Pages」点一次「更新」才生效；
 *      - EdgeOne Pages：自动部署，推送即上线。
 *  · 作品里的图片/视频：统一放在 gu-videos 仓库（图床），本仓库只存代码 + 配置，
 *    gu-videos 仓库已开 GitHub Pages，素材直接经 GitHub 域名引用（国内比 jsDelivr 稳）：
 *      https://icycal.github.io/gu-videos/portfolio/<slug>/<file>
 *    例如 "https://icycal.github.io/gu-videos/portfolio/zhuge/overview.webp"、
 *         "https://icycal.github.io/gu-videos/portfolio/stethoscope/stethoscope.mp4"。
 *    gu-videos 仓库里所有素材都在「作品集」目录下按作品 slug 分子目录存放
 *    （xiaodu / stethoscope / zhuge / wifimodule），详见该仓库 README。
 *    ⚠️ 不要再把大文件提交进本仓库——保持站点轻薄、部署快。
 *    （例外：works/firmware-vision、works/api-workbench 这两个内嵌 demo 是完整网页，
 *     连同它们 1KB 的 icon.svg 一起留在本仓库，同源加载更稳。）
 *
 *  ⚠️ 隐私提醒：本文件会随网站一起公开。敏感信息（身份证号、家庭住址等）
 *     请勿写在这里。教育经历的「显示/隐藏」是页面开关（只有能提交本仓库的人
 *     才能翻转），并非加密——别人查看网页源码仍可见原文，但普通访客看不到。
 * ========================================================================== */

window.SITE = {

  /* ---------- 顶部品牌 / Hero ---------- */
  profile: {
    name: "顾亚辉",
    nameAccent: "亚辉",      // 品牌名里被高亮的那部分（一般取名字后两字）
    avatarText: "顾",        // 头像里显示的字（没图时的占位）
    title: "嵌入式软件工程师 · AIoT / 边缘计算",
    summary: "多年深耕智能硬件（AIoT）嵌入式开发，先后涉足仪器仪表、通讯模组、医疗器械、3C 电子、新能源等行业，从 MCU 底层到系统架构均有完整落地经验。",
    cta: [                   // 首屏两个按钮
      { text: "查看我的作品", href: "works.html", primary: true },
      { text: "联系我",       href: "#contact", primary: false }
    ],
    deployNote: "由 icycal 部署"   // 页脚署名，部署到别处可改
  },

  /* ---------- 关于我 ---------- */
  about: "多年物联网智能硬件（AIoT）嵌入式从业经验，积极乐观、学习力强，兼具创新与动手能力，对电子行业有浓厚兴趣。在校期间即钻研单片机与嵌入式开发；工作后从 MCU 到嵌入式 Linux、从物联网平台到 ROS2 机器人，持续在底层与系统架构上深耕。业余担任「21IC 中国电子网」侃单片机版版主（常用 id：冰零分子 / icycal）。",

  /* ---------- 概览数据条 ---------- */
  stats: [
    { value: "2014 至今", label: "嵌入式从业" },
    { value: "AIoT",    label: "物联网 / 边缘智能" }
  ],

  /* ---------- 技能栈（数组，随便增删） ---------- */
  skills: [
    "C / C++", "嵌入式 Linux", "RT-Thread", "STM32 / MCU",
    "物联网 IoT / AIoT", "WiFi / BLE", "ROS / ROS2", "边缘计算 / Edge AI",
    "SOA 架构", "CMake", "多核异构通信", "Android",
    "能量管理 / 微电网", "医疗可穿戴", "Git"
  ],

  /* ---------- 教育经历（visible:false 即隐藏） ----------
   * 想公开时把 visible 改成 true 即可；想彻底删掉，连整段 education 删掉也行。 */
  education: {
    visible: false,
    school: "周口师范学院",
    college: "物理与机电工程学院 · 自动化",
    years: "2010/9 – 2014/7",
    highlights: [
      "「挑战杯」第二届大学生创业计划大赛 优秀奖（担任总策划）",
      "河南省第二届机器人大赛「机器人游中国」一等奖（亚军，担任程序设计）",
      "申请「大学生科研创新基金」项目并获准结项"
    ]
  },

  /* ---------- 从业经验（概括式，不逐个展示公司名） ----------
   * visible:false 可整段隐藏。
   * summary：一两句概括你的从业背景（不写具体公司名）。
   * industries：用「行业 / 领域」标签概括你待过的公司类型。 */
  experience: {
    visible: true,
    summary: "曾就职于知名互联网公司、知名医疗器械企业、新能源科技企业与物联网方案商，长期深耕 AIoT / 嵌入式 Linux / ROS2 / 边缘计算 / 医疗可穿戴等方向，从 MCU 底层到系统架构均有完整落地经验。",
    industries: [
      "知名互联网公司（智能硬件 / AI 助手）",
      "知名医疗器械企业（智能可穿戴）",
      "新能源 / 储能科技企业",
      "物联网方案商（无线连接 / 网关）"
    ]
  },

  /* ---------- 项目作品（首页不放，列表页 / 详情页专用） ----------
   * 每个作品对象的字段：
   *   slug    -> 英文短名，详情页 URL 用（work.html?slug=xxx），必填且唯一
   *   title   -> 作品名
   *   summary -> 列表页一句话简介（留空则取 desc 前 60 字）
   *   desc    -> 详情页完整描述
   *   stack   -> 技术栈标签（纯展示）
   *   link    -> 可选外链（详情页按钮），不需要就填空字符串 ""
   *   cover   -> 列表页「首页图」：{ kind:"none"|"image"|"video", src:"" }
   *              none：渐变占位（显示标题首字）；image / video 填 gu-videos 的 GitHub Pages 外链
   *   media   -> 详情页「主展示」：{ kind:"none"|"image"|"video"|"web", src:"" }
   *              web：内嵌静态网页 iframe，配网址；其余同上
   *   gallery -> 可选，详情页多图：[ "https://icycal.github.io/gu-videos/..." ]（数组，可空）
   *
   * 加作品：复制一个 {...} 对象粘到数组里即可（记得填唯一 slug）。
   * 图片/视频：先上传到 gu-videos 仓库，再在这里填 GitHub Pages 外链（见文件头说明）。 */
  projects: [
    {
      slug: "zhuge-agent",
      title: "诸葛智能体",
      summary: "团队内部智能体操作系统：把分散的 AI 能力沉淀为组织可长期建设、共享和运营的 AI 能力底座。",
      desc: "面向团队内部场景的智能体操作系统。围绕 8 大能力模块构建：Skill（技能沉淀与复用）、CLI（命令行高效执行）、Agent（编排与维护）、用户变量（灵活配置、安全隔离）、确认卡（关键决策显式确认）、会话（上下文管理、持续协作）、运行观测（可观测、可追溯、可审计）、多端入口（多端接入、随时可用）。以「对话页」为团队成员最直接的入口，自然语言描述需求即可按上下文调用 Skill / CLI / Agent，覆盖开发、测试、运维、管理等多角色。",
      stack: "AI Agent · 多用户协作 · LLM",
      link: "",
      repo: "https://github.com/Icycal/zhuge.git",
      cover: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/zhuge/overview.webp" },
      media: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/zhuge/conversation.webp" },
      gallery: [
        "https://icycal.github.io/gu-videos/portfolio/zhuge/slide_03.webp",
        "https://icycal.github.io/gu-videos/portfolio/zhuge/slide_04.webp",
        "https://icycal.github.io/gu-videos/portfolio/zhuge/slide_05.webp",
        "https://icycal.github.io/gu-videos/portfolio/zhuge/slide_07.webp",
        "https://icycal.github.io/gu-videos/portfolio/zhuge/slide_08.webp",
        "https://icycal.github.io/gu-videos/portfolio/zhuge/slide_09.webp",
        "https://icycal.github.io/gu-videos/portfolio/zhuge/slide_10.webp"
      ]
    },
    {
      slug: "xiaodu",
      title: "儿童手表小度助手",
      /* 3D 版图面板用的脱敏标题（world.html 优先取它，其他页仍显示原名） */
      anonTitle: "儿童手表语音助手",
      summary: "百度 DuerOS 适配层「OneApp」，已落地小天才、华为、小寻等多款儿童手表。",
      desc: "百度 DuerOS 生态完整适配层「OneApp」，聚合语音助手 / 内容 / 学习工具 / 小游戏等，已应用于小天才、华为、小寻及众多白牌儿童手表。",
      stack: "DuerOS · LVGL",
      link: "https://icycal.github.io/gu-videos/portfolio/xiaodu/xiaoduwatch.mp4",
      cover: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/xiaodu/xiaodu-crop.webp", coverBg: "#fff", coverFit: "contain" },
      media: { kind: "video", src: "https://icycal.github.io/gu-videos/portfolio/xiaodu/xiaoduwatch.mp4" },
      gallery: []
    },
    {
      slug: "stethoscope",
      title: "智能多模听诊器",
      summary: "国内首款心电 + 心音采集、AI 辅助分析的智能听诊器。",
      desc: "国内首款集心电与心音采集、AI 辅助分析、多参数可调于一体的智能听诊器，BLE 传输至 APP 实时展示波形并上传云端分析。",
      stack: "nRF52840 · LVGL",
      link: "",
      cover: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/stethoscope/stethoscope-main.webp", coverBg: "#0f1422", coverFit: "contain" },
      media: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/stethoscope/stethoscope-main.webp" },
      gallery: [
        { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/stethoscope/stethoscope-photo.webp" },
        { kind: "video", src: "https://icycal.github.io/gu-videos/portfolio/stethoscope/stethoscope.mp4" }
      ]
    },
    {
      slug: "edgebox",
      title: "边缘计算盒子",
      summary: "航天机床数字孪生：首个基于 Linux 的产品，从 0 搭建框架实现 Modbus/OPCUA/LwM2M。",
      desc: "航天客户机床数字孪生项目：自连首个基于 Linux 的产品，cortex-A9（imx6q）上从 0 搭建 Linux 环境与通用框架，实现 Modbus / OPCUA / LwM2M。",
      stack: "Linux · 边缘计算",
      link: "",
      cover: { kind: "none" },
      media: { kind: "none" },
      gallery: []
    },
    {
      slug: "vpn-gateway",
      title: "以太网转 4G VPN 网关",
      summary: "远郊无 wifi 场景经 4G+VPN 访问内网，并衍生多款网桥产品。",
      desc: "远郊无 wifi 场景下，经以太网 + 4G + VPN 访问公司内网；开辟公司 4G 产品线，并实现以太网转 4G 网桥 / AP 网桥等衍生产品。",
      stack: "4G PPP · VPN",
      link: "",
      cover: { kind: "none" },
      media: { kind: "none" },
      gallery: []
    },
    {
      slug: "freelink",
      title: "freelink 自组网协议",
      summary: "对标 wifi mesh 的自连自组网协议，一键配网、自动树状组网、天生防环。",
      desc: "对标业界 wifi mesh 的自连自组网协议，多模组一键配网、自动树状组网、天生防环，各模组为 ap-sta 对等节点，无特殊中心节点。",
      stack: "WiFi Mesh · 网络",
      link: "",
      cover: { kind: "none" },
      media: { kind: "none" },
      gallery: []
    },
    {
      slug: "aidk-wifi",
      title: "AIDK 物联网平台 · WiFi 模组",
      summary: "自连 AIDK 物联网 WiFi 模组平台：驱动与协议栈升级、HTTP / LwM2M 组件接口设计、固件框架与 OTA 体系重构。",
      desc: "公司自有物联网平台 AIDK（基于 Cypress WiFi/BT-BLE 芯片 <原博通 bcm433xx 系列> + STM32F4）上的 WiFi 模组整体开发工作，涵盖 ALX830X / ALX850X 等模组型号。三部分工作整合如下： ①平台底座升级——将 AIDK 使用的 WiFi 驱动、操作系统及网络协议栈统一升级至最新版本，并完成稳定性验证； ②物联网组件接口设计——实现 HTTP 与 LwM2M 两套物联网接口：完善 AIDK 集成的 HTTP 协议库，实现 HTTP Digest 认证、添加 multipart/form-data 支持，并封装 HTTP POST 的 ACM（Alinket Control Message，类 AT 指令）接口；完成 AIDK LwM2M 通用模型实现，默认植入自连 WiFi 管理 Object，并改造 CoAPs 的 Block 机制以支撑模组自身的 LwM2M OTA 升级。用户无需关注 HTTP / LwM2M 协议细节，通过自连 ACM 协议即可低成本接入自连云；同时编写 AISDK（Host 端）HTTP GET/POST 与 LwM2M 通用模型 Demo 供参考； ③框架调整与固件体系——为更合理利用芯片存储资源并实现公司固件统一管理，重构 AIDK 框架；参与 OTA 扇区删除与移植；定制并实现自连固件格式 ALF（Alinket File），编写 exe 打包工具（通过 Makefile 自动将 bootloader、app、WiFi 固件及 DCT 转换为 ALF）；完成 Bootloader 2.0 升级（支持 Boot 下串口升级、跳转 App 前文件校验，提升系统稳健性）；实现自连文件系统 AFS 格式化工具，可在 PC 端直接格式化打包并下载进 Flash 使用。",
      stack: "Cypress WiFi/BLE · STM32F4 · LwM2M / CoAPs · HTTP · OTA · RTOS",
      link: "",
      cover: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/wifimodule/alx830x.webp", coverBg: "#0f1422", coverFit: "contain" },
      media: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/wifimodule/alx830x.webp" },
      gallery: [
        "https://icycal.github.io/gu-videos/portfolio/wifimodule/alx830x-spec.webp",
        "https://icycal.github.io/gu-videos/portfolio/wifimodule/alx850x.webp",
        "https://icycal.github.io/gu-videos/portfolio/wifimodule/alx850x-spec.webp"
      ]
    },
    {
      slug: "firmware-vision",
      title: "固件视界",
      summary: "诸葛东风外部小程序：浏览器本地解析嵌入式 ELF / MAP 文件，资源总览、地址空间图、符号搜索与 JSON 导出。",
      desc: "「固件视界」是诸葛平台的东风外部小程序，用于在浏览器本地解析嵌入式 ELF 与 MAP 文件。支持 ELF32/64（大小端）、section / program header / 符号表，以及 GNU ld、Keil / Arm Linker 的 MAP 解析；提供资源总览、地址空间图、资源层级图、符号搜索、筛选、排序与 JSON 导出。支持多 ELF/SO/MAP 同时导入或整目录批量导入；多模块分析汇总代码与数据体积并保留各共享库独立地址空间。文件经 Web Worker 在浏览器本地解析，不上传服务器，结果仅存于当前页面内存，刷新即释放。下方为内嵌的实时 demo（直接打开本站服务），需要源码可点「项目源码」前往独立仓库。",
      stack: "Web · ELF / MAP 解析 · Web Worker",
      link: "works/firmware-vision/index.html",
      repo: "https://github.com/Icycal/zhuge.dongfeng.firmware-vision.git",
      cover: { kind: "icon", src: "works/firmware-vision/icon.svg" },
      media: { kind: "web", src: "works/firmware-vision/index.html" },
      gallery: []
    },
    {
      slug: "api-workbench",
      title: "接口工坊",
      summary: "纯静态东风小程序：浏览器本地导入、编辑、导出 API 协议（Apifox / OpenAPI / Swagger）。",
      desc: "「接口工坊」是一个纯静态东风小程序，用于在浏览器本地导入、编辑和导出 API 协议。可导入 Apifox 项目 JSON、OpenAPI 3.x / Swagger JSON 或 YAML、Widdershins 风格 Markdown；支持新增与编辑接口、参数、请求体、响应、JSON 示例，以及数据模型、嵌套字段、引用与字段组。接口、模型与文档页默认锁定，需点击「解锁编辑」后方可修改。保留 Apifox 的引用结构，可导出 Apifox JSON、OpenAPI YAML、Markdown 与项目备份。使用 IndexedDB 自动保存，文件只在当前浏览器中处理。下方为内嵌的实时 demo（直接打开本站服务），需要源码可点「项目源码」前往独立仓库。",
      stack: "Web · API 协议 · IndexedDB",
      link: "works/api-workbench/index.html",
      repo: "https://github.com/Icycal/zhuge.dongfeng.api-workbench.git",
      cover: { kind: "icon", src: "works/api-workbench/icon.svg" },
      media: { kind: "web", src: "works/api-workbench/index.html" },
      gallery: []
    },
    {
      slug: "chitu-vla",
      title: "赤兔 VLA 平台",
      summary: "Jetson Orin NX 上的 ROS 2 视觉-语言-动作驾驶平台：SmolVLA 端到端推理，影子模式三重兜底，打通采集—训练—部署闭环。",
      desc: "「赤兔（Chitu）」是跑在 Jetson Orin NX 上的 ROS 2 Humble 车辆智能平台，面向阿克曼底盘，用 SmolVLA 打通「前方图像 + 车辆状态 + 任务指令 → 动作序列」的端到端推理链路。自研部分约 8,300 行 C++（ROS 节点、策略传输、控制链路）、4,200 行 Python（策略运行时、量化、数据工具）与 2,300 行原生 JS 控制台，5 周内 65 次提交独立完成。安全是设计主线：影子模式设置了三层边界——非 shadow 模式下策略适配器直接无法实例化，默认动作输出恒为零速、真实映射需显式解锁，控制多路复用器只在辅助 / 自主模式下才选通模型输出，因此影子推理在链路上到不了 cmd_vel。控制链路由控制租约（3~30 秒并带速度上限）、Deadman 保活（250ms 心跳，松手 300ms 归零）、20Hz 三源仲裁与安全守卫串联；守卫会强制归零非阿克曼分量，并在前方 0.45m 锥形区域内只封前进而保留倒车脱困。模型侧做进程隔离：策略运行时是独立进程，通过 Unix Socket 上的 Protobuf（4 字节长度前缀分帧，单帧上限 32MB）与 ROS 通信，把 torch / transformers / lerobot 与 ROS 2 彻底解耦；provider 抽象支持 Mock 与 SmolVLA 切换，量化提供 torchao 与自实现 per-channel 双引擎，权重压到 INT8、激活保持 bf16。数据闭环从 Episode 录制出发，以 observation_id 作为关联键对齐异步话题，按 Episode 整体切分以避免相邻帧跨训练 / 验证集造成时间相关性泄漏，转 LeRobot 数据集时若实测帧率与声明不符则直接报错而非静默重采样。工程化上配套 59 个脚本与 23 篇文档，发布产物用符号链接原子切换并自动回滚。",
      stack: "ROS 2 Humble · C++17 · SmolVLA · Jetson Orin NX · Python · Protobuf",
      link: "",
      repo: "https://gitee.com/binglingfenzi/vla_vehicle_platform",
      cover: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/chitu/chitu-logo.png?v=covicon29", coverBg: "#141019", coverFit: "contain" },
      media: { kind: "image", src: "https://icycal.github.io/gu-videos/portfolio/chitu/chitu-logo.png?v=covicon29" },
      gallery: []
    }
  ],

  /* ---------- SoC 职业版图（world.html 用） ----------
   *
   * 每个节点 = 芯片 die 上的一个 IP 模块。CPU Core 居中、其它 4 个散布四周，
   * 配上金色总线走线，构成"我是一个 SoC"的视觉隐喻。
   *
   *   chipName      模块名（顶面牌匾 / 面板大标题都取这个）
   *   short         公开的"代指标签"（某知名仪表公司 等，隐私保护用）
   *   chipType      io | connectivity | signal | accelerator | core
   *                 影响 3D 顶面图案与配色
   *   chipColor     模块主题色（hex）
   *   accent        模块点缀色（hex，标签/边框用）
   *   role / period / blurb / works / extraProjects  同旧约定
   *
   * 真实公司名（realName）只留在数据源里，公开界面一律用 chipName + short。
   * 加一个模块：复制对象改 id / chipName，其它字段填好即可。 */
  companies: [
    {
      id: "gpio",
      realName: "上海海恒机电仪表有限公司",
      short: "某知名仪表公司",
      chipName: "GPIO · UART",
      chipType: "io",
      chipColor: "#378ADD",
      accent: "#B5D4F4",
      role: "研发工程师 → 项目组 Team Leader",
      dept: "研发部",
      period: "2015/03 – 2017/05",
      start: "2015-03", end: "2017-05",
      blurb: "从仪器维护走向完整产品研发。2017 年晋升 Team Leader 带 3 人小组，负责 NXP LPC / STM32 固件、上位机与部分电路设计。",
      works: [],
      extraProjects: ["色度仪（污水色度自动检测）", "在线仪器通用软件框架", "仪器物联网远程监控"]
    },
    {
      id: "wifi",
      realName: "自连电子科技（上海）有限公司",
      short: "某知名模组公司",
      chipName: "WiFi / BLE IP",
      chipType: "connectivity",
      chipColor: "#1D9E75",
      accent: "#9FE1CB",
      role: "嵌入式软件工程师",
      dept: "AIDK 研发中心",
      period: "2017/05 – 2019/10",
      start: "2017-05", end: "2019-10",
      blurb: "公司核心持股员工之一。主导开辟 2G / 4G / VPN / 网关四条产品线，独立完成自组网协议 freelink 与首个 Linux 项目。",
      works: ["edgebox", "vpn-gateway", "freelink", "aidk-wifi"],
      extraProjects: ["冷链 IoT 解决方案", "AIDK 平台 WiFi 驱动与协议栈升级", "AIDK 物联网组件接口设计", "AIDK 框架调整升级"]
    },
    {
      id: "audio",
      realName: "上海微创医疗器械（集团）有限公司",
      short: "某知名医疗器械公司",
      chipName: "Audio Engine",
      chipType: "signal",
      chipColor: "#7F77DD",
      accent: "#CECBF6",
      role: "嵌入式软件工程师",
      dept: "商业发展部 · 新技术研发部",
      period: "2019/10 – 2021/05",
      start: "2019-10", end: "2021-05",
      blurb: "负责有源新产品预研、新技术开发与新平台搭建。参与国内首款集心电与心音采集、AI 辅助分析于一体的智能听诊器。",
      works: ["stethoscope"],
      extraProjects: ["智能听诊器预研", "智能体温贴预研", "手术直播盒"]
    },
    {
      id: "npu",
      realName: "上海小度人工智能有限公司（百度集团）",
      short: "知名互联网大厂",
      chipName: "NPU · AI",
      chipType: "accelerator",
      chipColor: "#D4537E",
      accent: "#F4C0D1",
      role: "高级研发工程师（嵌入式）",
      dept: "智能硬件 · 大商业产研部",
      period: "2021/05 – 2022/07",
      start: "2021-05", end: "2022-07",
      blurb: "从 0 搭建儿童手表语音助手 SDK，迭代至 v2.1.3，已对接国内头部儿童手表品牌及众多白牌手表厂商；参与自研语音操作系统开发与维护。",
      works: ["xiaodu"],
      extraProjects: []
    },
    {
      id: "cpu",
      realName: "上海融和智电新能源有限公司（国家电投集团）",
      short: "某央企背景能源科技公司",
      chipName: "Main CPU Core",
      chipType: "core",
      chipColor: "#E24B4A",
      accent: "#F09595",
      role: "嵌入式软件工程师 · 智能场站研发团队负责人",
      dept: "数字科技部",
      period: "2022/07 – 至今",
      start: "2022-07", end: "",
      blurb: "参与自研嵌入式 YEP 平台（SOA 架构中台）建设，孵化并带领站控、sEMS 能量管理、AIBox 边端推理三个小组。",
      works: ["zhuge-agent", "chitu-vla"],
      extraProjects: ["嵌入式 YEP 平台", "换电站控系统", "边端能量管理系统 sEMS", "边端推理系统 AIBox"]
    }
  ],

  /* ---------- 联系方式（href 为空的项不显示） ---------- */
  contact: [
    { label: "Gitee",          href: "https://gitee.com/binglingfenzi", ext: true },
    { label: "icycalgu@163.com", href: "", text: true },
    { label: "博客 / 待补充",    href: "" }
  ]
};
