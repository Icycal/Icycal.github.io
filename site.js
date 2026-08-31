/* ============================================================================
 *  个人主页 · 共享交互特效（首页 / 作品列表 / 作品详情 三页共用）
 *  - 顶部进度条、鼠标光晕、点击粒子、滚动揭示、卡片 3D 倾斜
 *  - Hero 3D 粒子球（仅当页面存在 #hero-canvas 时启用，失败自动降级）
 *  页面自己的渲染脚本请放在本文件之后。
 * ========================================================================== */
(function(){
  "use strict";

  try {

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var isMobile = isTouch || window.innerWidth < 768;

  /* 顶部进度条 */
  var progress = document.getElementById('progress');
  if (progress){
    function onScroll(){
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
      progress.style.width = (p * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll();
  }

  /* 顶部导航滚动收缩 */
  var navEl = document.querySelector('nav');
  if (navEl){
    var navScrolled = false;
    function onNavScroll(){
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var want = y > 24;
      if (want !== navScrolled){ navScrolled = want; navEl.classList.toggle('scrolled', want); }
    }
    window.addEventListener('scroll', onNavScroll, {passive:true});
    onNavScroll();
  }

  /* 打字机标题（纯装饰动画，文字内容不变） */
  var typeEl = document.querySelector('.type-title');
  if (typeEl && !reduceMotion && !isMobile){
    // 逐字把文本节点拆成 <span class="tc">，glitch 内部整段最后淡入
    var glitch = typeEl.querySelector('.glitch');
    var walker = [];
    typeEl.childNodes.forEach(function(node){
      if (node === glitch) return;
      if (node.nodeType === 3){ // 文本节点
        var txt = node.nodeValue;
        var frag = document.createDocumentFragment();
        for (var i=0;i<txt.length;i++){
          var sp = document.createElement('span');
          sp.className = 'tc';
          sp.textContent = txt[i];
          sp.style.opacity = '0';
          walker.push(sp);
          frag.appendChild(sp);
        }
        typeEl.replaceChild(frag, node);
      }
    });
    if (glitch) glitch.style.opacity = '0';
    typeEl.classList.add('typing');
    var step = 0;
    var total = walker.length;
    var timer = setInterval(function(){
      if (step < total){
        walker[step].style.opacity = '1';
        step++;
      } else {
        clearInterval(timer);
        typeEl.classList.remove('typing');
        if (glitch){ glitch.style.transition = 'opacity .5s'; glitch.style.opacity = '1'; }
      }
    }, 34);
  }

  /* 滚动揭示（延迟到下一 tick，等所有内联渲染脚本把 .reveal 节点先填进 DOM 再观察） */
  function setupReveal(){
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if ('IntersectionObserver' in window && !reduceMotion){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      }, {threshold:0.15});
      els.forEach(function(el){ io.observe(el); });
    } else {
      els.forEach(function(el){ el.classList.add('in'); });
    }
  }
  // 等所有内联脚本先跑完（它们可能同步创建 .reveal）
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(setupReveal, 0); });
  } else {
    setTimeout(setupReveal, 0);
  }

  /* 鼠标光晕 */
  var glow = document.getElementById('cursor-glow');
  if (glow){
    if (!isMobile){
      window.addEventListener('mousemove', function(e){
        glow.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
      }, {passive:true});
    } else { glow.style.display = 'none'; }
  }

  /* 点击迸发粒子 */
  var spark = document.getElementById('spark-canvas');
  if (spark && !isMobile && !reduceMotion){
    var sctx = spark.getContext('2d');
    var particles = [];
    function sizeSpark(){ spark.width = window.innerWidth; spark.height = window.innerHeight; }
    sizeSpark();
    window.addEventListener('resize', sizeSpark);
    window.addEventListener('click', function(e){
      var colors = ['#5b8cff','#7c5cff','#9b8cff','#5bd0ff'];
      for (var i=0;i<16;i++){
        var a = Math.random()*Math.PI*2;
        var sp = 2 + Math.random()*4;
        particles.push({ x:e.clientX, y:e.clientY, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:1, c:colors[(Math.random()*colors.length)|0], r:2+Math.random()*3 });
      }
      if (!spark._raf) loopSpark();
    });
    function loopSpark(){
      sctx.clearRect(0,0,spark.height,spark.width);
      for (var i=particles.length-1;i>=0;i--){
        var p = particles[i];
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.08; p.life-=0.025;
        if (p.life<=0){ particles.splice(i,1); continue; }
        sctx.globalAlpha = Math.max(p.life,0);
        sctx.fillStyle = p.c;
        sctx.beginPath(); sctx.arc(p.x,p.y,p.r,0,Math.PI*2); sctx.fill();
      }
      sctx.globalAlpha = 1;
      if (particles.length) requestAnimationFrame(loopSpark);
      else spark._raf = false;
    }
  }

  /* 卡片 3D 倾斜（作品卡 / 项目卡） */
  if (!isMobile && !reduceMotion){
    document.querySelectorAll('.card, .work-card').forEach(function(card){
      card.addEventListener('mousemove', function(e){
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left)/r.width - 0.5;
        var py = (e.clientY - r.top)/r.height - 0.5;
        card.style.transform = 'rotateY('+(px*8).toFixed(2)+'deg) rotateX('+(-py*8).toFixed(2)+'deg) translateY(-4px)';
      });
      card.addEventListener('mouseleave', function(){ card.style.transform = ''; });
    });
  }

  /* 图片灯箱（作品详情页 gallery，用事件委托，兼容内容后渲染） */
  var lb = document.getElementById('lightbox');
  if (lb){
    lb.addEventListener('click', function(e){
      if (e.target === lb || (e.target.classList && e.target.classList.contains('close'))) lb.classList.remove('show');
    });
    document.addEventListener('click', function(e){
      var img = e.target && e.target.closest ? e.target.closest('.gallery img') : null;
      if (img){ lb.querySelector('img').src = img.src; lb.classList.add('show'); }
    });
  }

  /* Hero 3D 粒子球（仅首页；无 Three.js 或报错则隐藏，不影响内容）
     ⚠ 时序坑：#hero-canvas 是首页内联脚本用 app.innerHTML 动态创建的，
       而 site.js 比那段内联脚本先执行，此刻 canvas 还不存在。
       必须等 DOMContentLoaded 之后再初始化，否则粒子球永远不会出现。 */
  function initHero3D(){
    var canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    try {
      var renderer = new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 4.2;

      var N = 900;
      var pos = new Float32Array(N*3);
      var col = new Float32Array(N*3);
      var cA = new THREE.Color(0x5b8cff), cB = new THREE.Color(0x7c5cff);
      for (var i=0;i<N;i++){
        var t = i/N*Math.PI*2;
        var radius = 1.6 + Math.sin(t*7)*0.25;
        var phi = Math.acos(1 - 2*(i+0.5)/N);
        var theta = Math.PI*(1+Math.sqrt(5))*i;
        pos[i*3]   = radius*Math.sin(phi)*Math.cos(theta);
        pos[i*3+1] = radius*Math.sin(phi)*Math.sin(theta);
        pos[i*3+2] = radius*Math.cos(phi);
        var c = cA.clone().lerp(cB, (Math.sin(phi)+1)/2);
        col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
      geo.setAttribute('color', new THREE.BufferAttribute(col,3));
      var mat = new THREE.PointsMaterial({size:0.045, vertexColors:true, transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending});
      var points = new THREE.Points(geo, mat);
      scene.add(points);

      var tgt = {x:0,y:0};
      window.addEventListener('mousemove', function(e){
        tgt.x = (e.clientX/window.innerWidth - 0.5);
        tgt.y = (e.clientY/window.innerHeight - 0.5);
      }, {passive:true});

      function resize(){
        var w = canvas.clientWidth || window.innerWidth;
        var h = canvas.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w/h; camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', resize); resize();

      (function animate(){
        requestAnimationFrame(animate);
        points.rotation.y += 0.0016;
        points.rotation.x += (tgt.y*0.4 - points.rotation.x)*0.05;
        points.rotation.y += (tgt.x*0.4)*0.05;
        renderer.render(scene, camera);
      })();
    } catch(err){
      canvas.style.display = 'none';
    }
  }

  /* canvas 由页面内联脚本后创建，两种分支都要等它出现再处理 */
  function whenHeroReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  if (!isMobile && !reduceMotion && typeof THREE !== 'undefined'){
    whenHeroReady(initHero3D);
  } else {
    whenHeroReady(function(){
      var hc2 = document.getElementById('hero-canvas');
      if (hc2) hc2.style.display = 'none';
    });
  }

  /* 暴露给页面渲染脚本的小工具 */
  window.SiteKit = {
    esc: function(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  };
} catch(err){
  // 特效任何一处异常都不能连累页面渲染：兜底暴露 SiteKit，并把错误打到控制台
  if (!window.SiteKit){
    window.SiteKit = {
      esc: function(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    };
  }
  try { console.error('[site.js] 特效脚本异常（已降级，不影响内容）：', err); } catch(_){}
}
})();
