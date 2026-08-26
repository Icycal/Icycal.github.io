/* ============================================================================
 *  个人主页 · 内容配置（你以后只改这一个文件）
 *  ----------------------------------------------------------------------------
 *  · 改文字 / 加技能 / 加经历 / 加作品，全部在这里完成，不用碰 index.html。
 *  · 改完保存后：
 *      - Gitee Pages：回「服务 → Gitee Pages」点一次「更新」才生效；
 *      - EdgeOne Pages：自动部署，推送即上线。
 *  · 作品里的图片/视频：把文件放进本仓库的 works/ 目录，media.src 写成
 *    "works/文件名.jpg" 即可；也可以直接填外链 http(s) 地址。
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
   *              none：渐变占位（显示标题首字）；image：works/xxx.jpg 或 http 链接；
   *              video：works/xxx.mp4 或 http 链接（列表页只做封面，不自动播放）
   *   media   -> 详情页「主展示」：{ kind:"none"|"image"|"video"|"web", src:"" }
   *              web：内嵌静态网页 iframe，配网址；其余同上
   *   gallery -> 可选，详情页多图：[ "works/a.jpg", "works/b.jpg" ]（数组，可空）
   *
   * 加作品：复制一个 {...} 对象粘到数组里即可（记得填唯一 slug）。
   * 图片/视频：把文件放进本仓库的 works/ 目录，src 写成 "works/文件名" 即可。 */
  projects: [
    {
      slug: "zhuge-agent",
      title: "诸葛智能体",
      summary: "团队内部智能体操作系统：把分散的 AI 能力沉淀为组织可长期建设、共享和运营的 AI 能力底座。",
      desc: "面向团队内部场景的智能体操作系统。围绕 8 大能力模块构建：Skill（技能沉淀与复用）、CLI（命令行高效执行）、Agent（编排与维护）、用户变量（灵活配置、安全隔离）、确认卡（关键决策显式确认）、会话（上下文管理、持续协作）、运行观测（可观测、可追溯、可审计）、多端入口（多端接入、随时可用）。以「对话页」为团队成员最直接的入口，自然语言描述需求即可按上下文调用 Skill / CLI / Agent，覆盖开发、测试、运维、管理等多角色。",
      stack: "AI Agent · 多用户协作 · LLM",
      link: "",
      repo: "https://github.com/Icycal/zhuge.git",
      cover: { kind: "image", src: "works/zhuge/overview.png" },
      media: { kind: "image", src: "works/zhuge/conversation.png" },
      gallery: [
        "works/zhuge/slide_03.png",
        "works/zhuge/slide_04.png",
        "works/zhuge/slide_05.png",
        "works/zhuge/slide_07.png",
        "works/zhuge/slide_08.png",
        "works/zhuge/slide_09.png",
        "works/zhuge/slide_10.png"
      ]
    },
    {
      slug: "xiaodu",
      title: "儿童手表小度助手",
      summary: "百度 DuerOS 适配层「OneApp」，已落地小天才、华为、小寻等多款儿童手表。",
      desc: "百度 DuerOS 生态完整适配层「OneApp」，聚合语音助手 / 内容 / 学习工具 / 小游戏等，已应用于小天才、华为、小寻及众多白牌儿童手表。",
      stack: "DuerOS · LVGL",
      link: "https://raw.githubusercontent.com/Icycal/gu-videos/main/xiaoduwatch.mp4",
      cover: { kind: "none" },
      media: { kind: "video", src: "https://raw.githubusercontent.com/Icycal/gu-videos/main/xiaoduwatch.mp4" },
      gallery: []
    },
    {
      slug: "stethoscope",
      title: "智能多模听诊器",
      summary: "国内首款心电 + 心音采集、AI 辅助分析的智能听诊器。",
      desc: "国内首款集心电与心音采集、AI 辅助分析、多参数可调于一体的智能听诊器，BLE 传输至 APP 实时展示波形并上传云端分析。",
      stack: "nRF52840 · LVGL",
      link: "",
      cover: { kind: "none" },
      media: { kind: "none" },
      gallery: []
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
    }
  ],

  /* ---------- 联系方式（href 为空的项不显示） ---------- */
  contact: [
    { label: "Gitee",          href: "https://gitee.com/binglingfenzi", ext: true },
    { label: "icycalgu@163.com", href: "", text: true },
    { label: "博客 / 待补充",    href: "" }
  ]
};
