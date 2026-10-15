/* =============================================================
   守岸人的港湾 · 交互脚本
   1) 开场 → 主页（点按钮 / 点任意处 / 按 Enter 空格 Esc 都能进）
   2) 背景音乐：进入后自动播放，右下角可开关，选择会被记住
      出问题会在右下角弹出提示条，并告诉你浏览器去哪里找的文件
   3) 滚动出现动画 + 背景压暗
   ============================================================= */
(function () {
  'use strict';

  var body = document.body;
  var intro = document.getElementById('intro');
  var main = document.getElementById('main');
  var bgm = document.getElementById('bgm');
  var toggle = document.getElementById('musicToggle');
  var enterBtn = document.getElementById('enterBtn');
  var yearEl = document.getElementById('year');

  /* ---------------------------------------------
     1. 进入主页
     --------------------------------------------- */
  var entered = false;

  function enterSite() {
    if (entered) return;
    entered = true;

    // 先切界面：音频出任何问题都不会影响“进入”
    body.classList.remove('is-intro');
    body.classList.add('is-entered');
    if (intro) {
      intro.classList.add('is-leaving');
      intro.setAttribute('aria-hidden', 'true');
    }
    if (main) main.removeAttribute('inert');
    if (enterBtn) enterBtn.blur();

    // 进入时先检查一次首屏内容
    revealInView();

    // 再尝试放音乐
    showMusicToggle();
    if (musicWanted) {
      playMusic();
    } else {
      setToggleState(false, '');
    }

    // 桌宠：打个招呼，然后开始自己溜达 / 做小动作 / 偶尔吃口西瓜
    if (pet) pet.removeAttribute('inert');
    petSay('欢迎回来，这里的风很轻。', 4200);
    scheduleWander(6000);
    scheduleChat(22000);
    scheduleAction(7000);
  }

  if (enterBtn) enterBtn.addEventListener('click', enterSite);

  // 整个开场层都能点，防止按钮因为层级/动效问题点不到
  if (intro) intro.addEventListener('click', enterSite);

  // 键盘也能进（Esc 兼容“跳过开场”的习惯）
  document.addEventListener('keydown', function (e) {
    if (!entered && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key === 'Spacebar')) {
      e.preventDefault();
      enterSite();
    }
  });

  /* ---------------------------------------------
     2. 背景音乐
     --------------------------------------------- */
  var musicWanted = true;
  try {
    if (localStorage.getItem('harbor-music') === 'off') musicWanted = false;
  } catch (err) { /* 隐私模式下 localStorage 可能不可用，忽略 */ }

  var toggleText = toggle ? toggle.querySelector('.music-toggle__text') : null;
  var hint = document.getElementById('musicHint');
  var hintTimer = 0;
  var problem = '';          // 出问题时按钮上的文案，空串表示一切正常
  var fallbackTried = false; // 「bgm.mp3 放在 html 旁边」这种布局只试一次

  function showMusicHint(msg) {
    if (!hint) return;
    hint.textContent = msg;
    hint.hidden = false;
    clearTimeout(hintTimer);
    // 不自动消失：这是排查用的关键信息，点一下才关掉
  }

  if (hint) {
    hint.addEventListener('click', function () { hint.hidden = true; });
  }

  function setToggleState(playing, label) {
    problem = label || '';
    if (!toggle) return;
    toggle.dataset.playing = playing ? 'true' : 'false';
    toggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
    toggle.classList.toggle('is-unavailable', !!problem);
    if (toggleText) toggleText.textContent = problem || (playing ? '音乐开' : '音乐关');
    toggle.title = problem ? '背景音乐有问题，看旁边的提示' : (playing ? '点击关闭背景音乐' : '点击播放背景音乐');
  }

  function showMusicToggle() {
    if (toggle) toggle.hidden = false;
  }

  /**
   * 音乐加载不了时：
   * 1) 先试一次「bgm.mp3 就直接放在 index.html 旁边」的情况
   * 2) 还不行就把浏览器真正去找的路径显示出来，方便定位
   */
  function musicNotFound() {
    if (!fallbackTried && bgm) {
      var cur = bgm.getAttribute('src') || '';
      if (cur.indexOf('assets/') === 0) {
        fallbackTried = true;
        bgm.setAttribute('src', cur.slice(7));   // assets/bgm.mp3 -> bgm.mp3
        bgm.load();
        playMusic();
        return;
      }
    }
    fallbackTried = true;
    setToggleState(false, '缺少 bgm.mp3');
    var where = 'assets/bgm.mp3';
    try { where = bgm.src; } catch (e) { /* 忽略 */ }
    showMusicHint('找不到音乐文件。浏览器去这里找了：' + where + ' —— 把 bgm.mp3 放到这个位置就行（文件名要全小写）。');
  }

  function playMusic() {
    if (!bgm) return;
    try {
      var p = bgm.play();
      // 现代浏览器返回 Promise；老浏览器返回 undefined，不能直接 .catch
      if (p && typeof p.then === 'function') {
        p.then(function () { setToggleState(true, ''); })
         .catch(function (err) {
           var name = (err && err.name) || '';
           if (name === 'NotSupportedError') {
             // 文件不存在 / 路径不对 / 格式不支持，都会走到这里
             musicNotFound();
           } else if (name === 'NotAllowedError') {
             setToggleState(false, '');
             showMusicHint('浏览器没允许自动播放。点右下角的按钮可以手动打开音乐。');
           } else {
             setToggleState(false, '音乐不可用');
             showMusicHint('背景音乐没能播放（' + (name || '未知原因') + '）。点右下角的按钮可以再试一次。');
           }
           if (window.console) console.warn('[守岸人的港湾] play() 被拒绝：', err);
         });
      } else {
        setToggleState(true, '');
      }
    } catch (err) {
      setToggleState(false, '音乐不可用');
      showMusicHint('背景音乐启动失败：' + ((err && err.message) || err));
      if (window.console) console.warn('[守岸人的港湾] play() 抛错：', err);
    }
  }

  if (bgm) {
    bgm.addEventListener('playing', function () { setToggleState(true, ''); });
    bgm.addEventListener('pause', function () {
      // 出错后浏览器也会触发 pause，别把错误提示冲掉
      if (!problem) setToggleState(false, '');
    });
    bgm.addEventListener('error', function () {
      var code = bgm.error ? bgm.error.code : 0;
      if (code === 4) {
        musicNotFound();
      } else if (code === 3) {
        setToggleState(false, '音频损坏');
        showMusicHint('bgm.mp3 解码失败，换一个音频文件试试。');
      } else {
        setToggleState(false, '音乐不可用');
        showMusicHint('背景音乐加载失败（错误码 ' + code + '）。按 F12 打开控制台可以看到详细信息。');
      }
      if (window.console) console.warn('[守岸人的港湾] audio error code =', code);
    });
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      if (!bgm) return;
      if (bgm.paused) {
        musicWanted = true;
        fallbackTried = false;   // 允许再试一次（比如刚把文件放好）
        playMusic();
      } else {
        musicWanted = false;
        bgm.pause();
      }
      try {
        localStorage.setItem('harbor-music', musicWanted ? 'on' : 'off');
      } catch (err) { /* 忽略 */ }
    });
  }

  /* ---------------------------------------------
     3. 滚动出现 + 背景压暗
     --------------------------------------------- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var pending = reveals.slice();

  function markVisible(el) {
    el.classList.add('is-visible');
    var i = pending.indexOf(el);
    if (i > -1) pending.splice(i, 1);
  }

  // 兜底：万一 IntersectionObserver 没触发（某些预览器 / 老旧浏览器），
  // 滚动时用 getBoundingClientRect 再判断一次，保证内容一定会出现。
  function revealInView() {
    if (!pending.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    pending.slice().forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) markVisible(el);
    });
  }

  var ticking = false;
  function onScrollReveal() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      revealInView();
      updatePetNav();
    });
  }

  window.addEventListener('scroll', onScrollReveal, { passive: true });
  window.addEventListener('resize', onScrollReveal, { passive: true });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          markVisible(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

    reveals.forEach(function (el) { io.observe(el); });

    // 首屏滚出视野后，把背景图压暗，让下面的内容看得清
    var hero = document.querySelector('.hero');
    if (hero) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          body.classList.toggle('is-scrolled', !entry.isIntersecting);
        });
      }, { threshold: 0.12 }).observe(hero);
    }
  } else {
    reveals.forEach(markVisible);
  }

  /* ---------------------------------------------
     5. 桌宠：Q 版守岸人（说话 + 自己走动 + 导航 + 拖动）
     --------------------------------------------- */
  var pet = document.getElementById('pet');
  var petBtn = document.getElementById('petBtn');
  var petMenu = document.getElementById('petMenu');
  var petSpeech = document.getElementById('petSpeech');
  var petLinks = petMenu ? Array.prototype.slice.call(petMenu.querySelectorAll('a[href^="#"]')) : [];
  var PET_POS_KEY = 'harbor-pet-pos';
  var PET_QUIET_KEY = 'harbor-pet-quiet';
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var petQuiet = false;
  try {
    petQuiet = localStorage.getItem(PET_QUIET_KEY) === 'on';
  } catch (err) { /* 忽略 */ }

  /* ✏️ 她的台词就改这两行 */
  var PET_LINES = [
    '潮汐不眠，我一直在这儿。',
    '欢迎回来，这里的风很轻。',
    '蝴蝶认得回家的路。',
    '时间像潮水一样，慢慢流过去。',
    '蓝色的星星，只在夜里亮。',
    '累的话，就靠岸歇一会儿。',
    '这片海岸，只属于我们。'
  ];
  var PET_WALK_LINES = ['跟我来。', '四处看看…', '这里的浪声很好听。'];
  var PET_NAV_LINES = ['想去哪里看看？', '我带你走。', '要看哪一段？'];
  var PET_EAT_LINES = ['西瓜很甜。', '夏天就该吃这个。', '要一起吃吗？'];

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  // 图片原生拖拽会打断 pointer 事件流，导致真实鼠标「拖不动」——直接掐掉
  document.addEventListener('dragstart', function (e) {
    if (pet && pet.contains(e.target)) e.preventDefault();
  });

  /* ---------- 贴边：拖到左右边缘就停在边上（正常站着、转身朝屏幕里侧） ---------- */
  /* ================= 贴边（重写） =================
     规则：① 你拖到左右边缘松手 → 吸附、常驻、保持「靠着」姿势，不再自己走开
           ② 点她一下 → 出来，继续溜达
           ③ 直接拖她 → 跟着你的手走（同时解除贴边）
     状态只有两个来源：dockTo() 设置、undock() 清除；其它任何地方都不许改。 */
  var clinging = '';          // '' | 'l' | 'r'（走动/小动作的调度器靠它判断"贴边时别乱走"）
  var dockedSide = '';        // 常驻贴边的旗标
  var EDGE_NEAR = 64;         // 松手时离边缘这么近就吸附
  var DOCK_PAD = 4;           // 身体与屏幕边留几像素
  var lastDropAt = 0;

  // 闭环对齐：反复量「看得见的身体」并微调 left，直到距边 DOCK_PAD（镜像/倾斜/留白都被吸收）
  function alignToEdge(side) {
    if (!pet) return;
    var vw = window.innerWidth;
    (function loop(n) {
      var u = pet.querySelector('.pet__upper');
      if (!u) return;
      var ur = u.getBoundingClientRect();
      var delta = (side === 'l') ? (ur.left - DOCK_PAD) : (vw - DOCK_PAD - ur.right);
      if (Math.abs(delta) < 1) return;
      // delta 都是「身体还需要往哪边挪多少」：左侧需求为正表示要往左，右侧为正表示要往右
      var dir = (side === 'l') ? -1 : 1;
      var step = Math.max(-120, Math.min(120, delta));
      pet.style.left = ((parseFloat(pet.style.left) || 0) + dir * step) + 'px';
      if (Math.abs(delta) > 1 && n < 26) requestAnimationFrame(function () { loop(n + 1); });
    })(0);
  }

  // 贴边定位：盒子贴到屏幕边（躲藏量交给 CSS 的 translateX）
  function placeDocked(side) {
    if (!pet) return;
    var w = pet.getBoundingClientRect().width || 168;
    pet.style.left = (side === 'l' ? 4 : window.innerWidth - w - 4) + 'px';
  }

  function dockTo(side) {
    if (!pet || !side) return;
    dockedSide = side;
    clinging = side;
    clearTimeout(walkTimer);
    walking = false;
    pet.classList.remove('is-walking', 'is-dropping', 'is-edgepeek', 'is-edgesit');
    pet.classList.toggle('is-facing-left', side === 'l');       // 面朝屏幕里侧
    pet.classList.remove('pet--edge-l', 'pet--edge-r');
    pet.classList.add(side === 'l' ? 'pet--edge-l' : 'pet--edge-r');
    pet.style.setProperty('--wx', '0px');
    pet.style.setProperty('--wy', '0px');
    walkX = 0;
    walkY = 0;
    pausedUntil = Date.now() + 3600000;                          // 常驻期间不自己乱跑
    placeDocked(side);                                           // 盒子贴边；「只露脑袋」由 CSS 位移完成
    petSay(pick(['我就在这儿待着。', '靠着边舒服。', '这儿视野不错。']), 2600);
  }

  function undock(silent) {
    if (!pet) return;
    var was = dockedSide || clinging;
    dockedSide = '';
    clinging = '';
    pet.classList.remove('pet--edge-l', 'pet--edge-r', 'is-leaning', 'is-edgesit', 'is-edgepeek');
    if (!was) return;
    walkX = 0;
    walkY = 0;
    pet.style.setProperty('--wx', '0px');
    pet.style.setProperty('--wy', '0px');
    pet.style.left = Math.min(Math.max(parseFloat(pet.style.left) || 0, 4),
                              Math.max(4, window.innerWidth - 200)) + 'px';
    pausedUntil = Date.now() + 3000;
    if (!silent) petSay('站好了。', 1800);
    scheduleWander(5000);
  }

  // 松手后判断是否吸附（用可见身体的边缘判断，而不是图片框）
  function maybeDock() {
    if (!pet) return false;
    var u = pet.querySelector('.pet__upper') || pet;
    var r = u.getBoundingClientRect();
    var vw = window.innerWidth;
    var side = r.left <= EDGE_NEAR ? 'l' : (r.right >= vw - EDGE_NEAR ? 'r' : '');
    if (!side) return false;
    dockTo(side);
    return true;
  }

  function petMenuIsOpen() {
    return !!(petMenu && petMenu.classList.contains('is-open'));
  }

  // 桌宠在屏幕右半边时，菜单/气泡改往左边弹
  function updatePetFlip() {
    if (!pet) return;
    var r = pet.getBoundingClientRect();
    var centerX = r.left + r.width / 2;
    pet.classList.toggle('pet--flip', centerX > window.innerWidth * 0.55);
  }

  function openPetMenu(open) {
    if (!petMenu || !petBtn) return;
    petMenu.classList.toggle('is-open', open);
    petMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    petBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (pet) pet.classList.toggle('is-menu-open', open);
    if (open) {
      pausedUntil = Date.now() + 15000;   // 菜单开着的时候先别乱跑
    }
  }

  /* ---------- 说话 ---------- */
  var speechTimer = 0;
  var lastSpokeAt = 0;

  function petSay(text, ms) {
    if (!petSpeech || !text || petQuiet) return;   // 安静模式下不说话
    petSpeech.textContent = text;
    petSpeech.classList.add('is-show');
    lastSpokeAt = Date.now();
    clearTimeout(speechTimer);
    var dur = ms || Math.min(9000, 2600 + text.length * 180);
    speechTimer = setTimeout(function () {
      petSpeech.classList.remove('is-show');
    }, dur);
  }

  // 隔一阵自己嘀咕一句（正在说话 / 开着菜单 / 安静模式时不说）
  var chatTimer = 0;
  function scheduleChat(delay) {
    clearTimeout(chatTimer);
    if (reduceMotion || petQuiet) return;
    chatTimer = setTimeout(function () {
      if (entered && !petQuiet && !document.hidden && !petMenuIsOpen() && petSpeech &&
          !petSpeech.classList.contains('is-show') && Date.now() - lastSpokeAt > 8000) {
        petSay(pick(PET_LINES));
      }
      scheduleChat(18000 + Math.random() * 22000);
    }, delay || (16000 + Math.random() * 16000));
  }



  /* ---------- 安静模式 ---------- */
  var petQuietBtn = document.getElementById('petQuiet');
  var petQuietText = petQuietBtn ? petQuietBtn.querySelector('.pet__quiet-text') : null;

  function applyQuiet(on, silent) {
    petQuiet = !!on;
    if (pet) pet.classList.toggle('is-quiet', petQuiet);
    if (petQuietBtn) petQuietBtn.setAttribute('aria-pressed', petQuiet ? 'true' : 'false');
    if (petQuietText) petQuietText.textContent = petQuiet ? '安静模式：开' : '安静模式：关';
    try {
      localStorage.setItem(PET_QUIET_KEY, petQuiet ? 'on' : 'off');
    } catch (err) { /* 忽略 */ }

    if (petQuiet) {
      // 立刻停下来：把当前位置固定住，清掉待办，收回气泡
      freezeWalk();
      clearTimeout(wanderTimer);
      clearTimeout(chatTimer);
      clearTimeout(speechTimer);
      if (petSpeech) petSpeech.classList.remove('is-show');
    } else {
      pausedUntil = 0;              // 关掉安静模式后可以立刻恢复活动
      scheduleWander(3000);
      scheduleChat(14000);
      if (!silent) petSay('好，我继续走走。', 2600);
    }
  }

  if (petQuietBtn) {
    petQuietBtn.addEventListener('click', function () {
      applyQuiet(!petQuiet);
    });
  }

  /* ---------- 自己走动 ---------- */
  var walkX = 0, walkY = 0, walking = false, walkTimer = 0, wanderTimer = 0, pausedUntil = 0;

  function petHome() {
    var left = parseFloat(pet.style.left);
    var bottom = parseFloat(pet.style.bottom);
    return {
      left: isFinite(left) ? left : 28,
      bottom: isFinite(bottom) ? bottom : 24,
      w: pet.offsetWidth || 104
    };
  }

  // 把「当前视觉位置」固化成新的 left/bottom，并清掉走动偏移
  // （走动动画进行到一半时也能正确接住，不会跳位）
  function freezeWalk() {
    if (!pet) return;
    clearTimeout(walkTimer);
    walking = false;
    pet.classList.remove('is-walking');

    var r = pet.getBoundingClientRect();
    pet.style.setProperty('--walk-dur', '0s');
    pet.style.setProperty('--wx', '0px');
    pet.style.setProperty('--wy', '0px');
    walkX = 0;
    walkY = 0;
    pet.style.left = r.left + 'px';
    pet.style.bottom = (window.innerHeight - r.bottom) + 'px';
  }

  /* ---------- 贴边专属动作：靠着边坐一会儿 / 偶尔探头 ---------- */
  function scheduleEdgeAction(delay) {
    clearTimeout(edgeTimer);
    if (!clinging || reduceMotion || petQuiet || !pet) return;
    edgeTimer = setTimeout(function () {
      // 先核实她确实还在边缘：位置跑偏时就别再摆姿势了
      // 自愈：只要还站在边缘附近，就把贴边状态补回来
      (function selfHeal() {
        var u = pet.querySelector('.pet__upper');
        if (!u) return;
        var ur = u.getBoundingClientRect();
        var vwS = window.innerWidth;
        if (ur.left <= 8) { clinging = 'l'; pet.classList.add('pet--edge-l'); }
        else if (ur.right >= vwS - 8) { clinging = 'r'; pet.classList.add('pet--edge-r'); }
        if (clinging) pet.classList.add('is-leaning');
      })();
      if (clinging && !document.hidden && !petMenuIsOpen() && !pet.classList.contains('is-dragging')) {
        // 取消探头：它会打断「一直靠着」的姿势（用户明确要求常驻靠着）
      }
      scheduleEdgeAction(6000 + Math.random() * 7000);
    }, delay || (4000 + Math.random() * 4000));
  }

  function scheduleWander(delay) {
    clearTimeout(wanderTimer);
    if (reduceMotion || petQuiet || clinging || !pet) return;
    wanderTimer = setTimeout(wanderStep, delay || (4500 + Math.random() * 7000));
  }

  function wanderStep() {
    if (!pet || walking || acting || clinging || !entered || petQuiet || document.hidden ||
        petMenuIsOpen() || Date.now() < pausedUntil) {
      scheduleWander(3500);
      return;
    }
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var home = petHome();
    var h = pet.offsetHeight || 165;

    // 满屏都能去（留一点边距）
    var targetLeft = 6 + Math.random() * Math.max(1, vw - home.w - 12);
    var targetBottom = 6 + Math.random() * Math.max(1, vh - h - 12);

    var dx = (targetLeft - home.left) - walkX;
    var dy = (targetBottom - home.bottom) - walkY;
    if (Math.sqrt(dx * dx + dy * dy) < 50) { scheduleWander(3000); return; }
    startWalk(dx, dy);
  }

  /**
   * 一步一步走过去：预备（后倾下蹲）→ 分步挪动（每步都有腾空/落地挤压）
   * → 收尾过冲。这样才像在走，而不是整块图被平移。
   */
  function startWalk(dx, dy) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(2, Math.min(16, Math.round(dist / 80)));
    var stepX = dx / steps;
    var stepY = dy / steps;
    var stepMs = Math.max(180, Math.min(330, 320 - steps * 9));

    walking = true;
    // 走动前先脱掉一切姿势类：绝不允许「歪着/缩着」滑行，那是「倒着走」的来源
    ['is-edgesit', 'is-edgepeek', 'is-spinning', 'is-stretching', 'is-cheering', 'is-tilting', 'is-hopping']
      .forEach(function (c) { pet.classList.remove(c); });
    // 这个立绘默认偏朝「左」（刘海/视线/蝴蝶都在左侧），所以向右走时才镜像
    pet.classList.toggle('is-facing-left', dx > 0);
    pet.classList.add('is-anticipating');            // 预备动作
    pet.style.setProperty('--walk-dur', (stepMs / 1000).toFixed(2) + 's');

    clearTimeout(walkTimer);
    walkTimer = setTimeout(function () {
      pet.classList.remove('is-anticipating');
      pet.classList.add('is-walking');
      var done = 0;
      (function step() {
        if (done >= steps) { land(); return; }
        done += 1;
        walkX += stepX;
        walkY += stepY;
        pet.style.setProperty('--wx', Math.round(walkX) + 'px');
        pet.style.setProperty('--wy', Math.round(-walkY) + 'px');   // CSS 的 Y 轴向下
        updatePetFlip();
        walkTimer = setTimeout(step, stepMs);
      })();
    }, 230);

    function land() {
      pet.classList.remove('is-walking');
      pet.classList.add('is-settling');              // 收尾过冲
      setTimeout(function () { pet.classList.remove('is-settling'); }, 320);
      walking = false;
      updatePetFlip();
      if (Math.random() < 0.4 && !petMenuIsOpen()) petSay(pick(PET_WALK_LINES), 2600);
      scheduleWander();
    }
  }

  /* ---------- 性格小动作：转圈 / 趴下 / 蹦 / 伸懒腰 / 歪头 / 开心晃动 ---------- */
  var actionTimer = 0;
  var acting = false;
  var ACTIONS = ['tilt', 'hop', 'spin', 'stretch', 'cheer'];   // spin = 快速转身（不是整块翻滚）
  var ACTION_CLASS = {
    tilt: 'is-tilting', hop: 'is-hopping', spin: 'is-spinning',
    stretch: 'is-stretching', cheer: 'is-cheering'
  };
  var ACTION_MS = { hop: 700, spin: 1100, tilt: 1600, stretch: 1600, cheer: 2200 };

  function scheduleAction(delay) {
    clearTimeout(actionTimer);
    if (reduceMotion || petQuiet || clinging || !pet) return;
    actionTimer = setTimeout(function () {
      if (entered && !document.hidden && !petMenuIsOpen() && !walking && !acting &&
          Date.now() >= pausedUntil) {
        doAction(pick(ACTIONS));
      }
      scheduleAction(4000 + Math.random() * 5000);
    }, delay || (3500 + Math.random() * 4000));
  }

  function doAction(name) {
    if (!pet || acting) return;
    var cls = ACTION_CLASS[name];
    if (!cls) return;
    acting = true;
    pet.classList.add(cls);
    if (name === 'cheer') petSay(pick(['嘿嘿。', '今天也来看我啦？', '心情不错。']), 2600);
    setTimeout(function () {
      pet.classList.remove(cls);
      acting = false;
    }, ACTION_MS[name] || 1600);
  }

  /* ---------- 会注意到你：鼠标跑到另一边时她会转身（有时还蹦一下） ---------- */
  var lastLookAt = 0;
  document.addEventListener('mousemove', function (e) {
    if (!pet || !entered || walking || acting || clinging || petQuiet || petMenuIsOpen()) return;
    if (pet.classList.contains('is-dragging') || pet.classList.contains('is-dropping')) return;
    var now = Date.now();
    if (now - lastLookAt < 2500) return;
    var r = pet.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    if (Math.abs(e.clientX - cx) < 140) return;
    lastLookAt = now;
    pet.classList.toggle('is-facing-left', e.clientX > cx);
    if (Math.random() < 0.45) doAction('hop');
  }, { passive: true });

  if (petBtn) {
    petBtn.addEventListener('click', function () {
      // 刚拖完的那一下不算“点击”
      if (pet && pet.dataset.dragged === '1') return;
      if (clinging || dockedSide) {          // 正贴着边：点一下＝出来，继续溜达
        if (Date.now() - lastDropAt < 600) return;   // 拖放余波的 click 不算「点她」
        undock();
        return;
      }
      updatePetFlip();
      var willOpen = !petMenuIsOpen();
      openPetMenu(willOpen);
      if (willOpen) petSay(pick(PET_NAV_LINES), 3600);
      if (pet) {
        pet.classList.add('is-poked');
        setTimeout(function () { pet.classList.remove('is-poked'); }, 460);
      }
    });
  }

  if (petMenu) {
    // 点导航项：收起菜单（平滑滚动交给全局的锚点逻辑）
    petMenu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a[href^="#"]')) openPetMenu(false);
    });
  }

  // 点空白处 / 按 Esc 收起
  document.addEventListener('pointerdown', function (e) {
    if (!petMenuIsOpen() || !pet) return;
    if (!pet.contains(e.target)) openPetMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && petMenuIsOpen()) {
      openPetMenu(false);
      if (petBtn) petBtn.focus();
    }
  });

  // 拖动桌宠，位置会记住
  (function () {
    if (!pet || !petBtn) return;
    var dragging = false;
    var moved = false;
    var startX = 0, startY = 0, startLeft = 0, startBottom = 0;

    function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

    function savePos() {
      try {
        localStorage.setItem(PET_POS_KEY, JSON.stringify({
          left: pet.style.left, bottom: pet.style.bottom
        }));
      } catch (err) { /* 忽略 */ }
    }

    function applyPos(left, bottom) {
      var w = pet.offsetWidth || 104;
      var h = pet.offsetHeight || 140;
      pet.style.left = clamp(left, 4, Math.max(4, window.innerWidth - w - 4)) + 'px';
      pet.style.bottom = clamp(bottom, 4, Math.max(4, window.innerHeight - h - 4)) + 'px';
      updatePetFlip();
    }

    petBtn.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();                            // 阻止选中文字 / 触发图片原生拖拽
      freezeWalk();                                  // 先把走动偏移并进 left/bottom
      var r = pet.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = r.left;
      startBottom = window.innerHeight - r.bottom;
      if (petBtn.setPointerCapture) {
        try { petBtn.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
    });

    petBtn.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;   // 小抖动不算拖动
      if (!moved) {
        moved = true;
        if (clinging || dockedSide) undock(true);   // 真的开始拖了才解除贴边
        pet.classList.add('is-dragging');
        openPetMenu(false);
      }
      applyPos(startLeft + dx, startBottom - dy);
      // 靠近边缘就亮起吸附提示条，松手即贴上去
      var nr = pet.getBoundingClientRect();
      var nearL = nr.left <= EDGE_NEAR;
      var nearR = nr.right >= window.innerWidth - EDGE_NEAR;
      document.body.classList.toggle('is-dock-l', nearL && !nearR);
      document.body.classList.toggle('is-dock-r', nearR && !nearL);
      e.preventDefault();
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      pet.classList.remove('is-dragging');
      document.body.classList.remove('is-dock-l', 'is-dock-r');
      pet.classList.add('is-dropping');                 // 落地压一下
      setTimeout(function () { pet.classList.remove('is-dropping'); }, 420);
      pet.dataset.dragged = '1';                 // 让紧随其后的 click 不打开菜单
      lastDropAt = Date.now();
      freezeWalk();
      savePos();
      updatePetFlip();
      pausedUntil = Date.now() + 12000;          // 你放哪儿她就在哪儿待一会儿
      setTimeout(function () { pet.dataset.dragged = '0'; }, 350);
      setTimeout(maybeDock, 40);                 // 松手：贴着左右边缘就吸附
    }
    petBtn.addEventListener('pointerup', endDrag);
    petBtn.addEventListener('pointercancel', endDrag);

    // 恢复上次拖到的位置（先夹到当前视口内，免得换小屏后跑到屏幕外）
    try {
      var saved = JSON.parse(localStorage.getItem(PET_POS_KEY) || 'null');
      if (saved && saved.left && saved.bottom) {
        var sl = parseFloat(saved.left);
        var sb = parseFloat(saved.bottom);
        if (isFinite(sl) && isFinite(sb)) applyPos(sl, sb);
      }
    } catch (err) { /* 忽略 */ }

    window.addEventListener('resize', function () {
      // 视口变了：走动偏移清零，再按新的范围夹一次
      walkX = 0;
      walkY = 0;
      pet.style.setProperty('--wx', '0px');
      pet.style.setProperty('--wy', '0px');
      var r = pet.getBoundingClientRect();
      if (pet.style.left) applyPos(r.left, window.innerHeight - r.bottom);
    }, { passive: true });
  })();

  // 切走标签页就别走了，回来再继续
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimeout(wanderTimer);
      clearTimeout(chatTimer);
      clearTimeout(walkTimer);
      clearTimeout(actionTimer);
    } else if (entered) {
      walking = false;
      if (pet) pet.classList.remove('is-walking');
      scheduleWander(4000);
      scheduleChat(6000);
      scheduleAction(5000);
    }
  });

  // 窗口尺寸变化：贴边位置重算（手机上地址栏收起会改变高度）
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    if (!pet || !clinging) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!clinging) return;
      placeDocked(clinging);
    }, 160);
  });

  // 看门狗：你亲手放到边上的状态、姿势、对齐，丢了就立刻补回来
  setInterval(function () {
    if (!dockedSide || !pet) return;
    var want = 'pet--edge-' + dockedSide;
    if (!pet.classList.contains(want) || clinging !== dockedSide) {
      clinging = dockedSide;
      pet.classList.add(want);
      placeDocked(dockedSide);
    }
  }, 800);

  // 菜单里高亮当前所在的版块
  function updatePetNav() {
    if (!petLinks.length) return;
    var y = window.scrollY + window.innerHeight * 0.35;
    var current = petLinks[0];
    petLinks.forEach(function (a) {
      var href = a.getAttribute('href');
      var el = href === '#top' ? document.querySelector('.hero') : document.querySelector(href);
      if (!el) return;
      var top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= y) current = a;
    });
    petLinks.forEach(function (a) { a.classList.toggle('is-current', a === current); });
  }

  /* ---------------------------------------------
     4. 杂项
     --------------------------------------------- */
  // 开场期间不让键盘 Tab 进到主内容里
  if (main) main.setAttribute('inert', '');
  if (pet) pet.setAttribute('inert', '');

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  updatePetNav();
  updatePetFlip();

  // 恢复「安静模式」的开关状态（静默应用，不触发她说话）
  applyQuiet(petQuiet, true);

  // 锚点平滑滚动
  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link) return;
    var id = link.getAttribute('href');
    if (!id || id === '#') return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ================= 8. 行为感知：跟着你的动作说话 ================= */
  var REACT = {
    scrollFast: ['慢一点…我跟不上了。', '这段有点长，慢慢看。'],
    idle:       ['你还在吗？', '我在这儿等着。', '……（小声）'],
    hover:      ['嗯？', '怎么啦。'],
    poke:       ['别戳啦。', '痒。', '再戳我就躲了。'],
    drag:       ['要带我去哪儿？', '轻一点…', '我自己会走啦。'],
    dock:       ['我就在这儿待着。', '靠着边舒服。'],
    away:       ['你回来啦。', '去哪儿了？'],
    night:      ['这么晚还不睡？', '夜色正好。'],
    copy:       ['要抄下来吗？', '记得写上我的名字。'],
    musicOn:    ['好听吗？', '这首歌我很喜欢。'],
    musicOff:   ['安静一点也不错。'],
    top:        ['回到开头了。', '再看一遍？'],
    about:      ['这是自我介绍那段。', '多写点嘛。'],
    interests:  ['你也在意这些吗？', '兴趣相同就好。'],
    contact:    ['想找我的话，就在这儿。', '别害羞。']
  };
  var lastReact = 0, lastReactKey = '';
  function react(key, force) {
    if (!entered || !pet || petQuiet || reduceMotion) return false;
    var pool = REACT[key];
    if (!pool) return false;
    var now = Date.now();
    if (!force && now - lastReact < 9000) return false;              // 全局冷却：别一直叨叨
    if (!force && key === lastReactKey && now - lastReact < 40000) return false;
    lastReact = now; lastReactKey = key;
    petSay(pick(pool), 2600);
    return true;
  }

  // 8.1 快速滚动
  var lastY = window.scrollY, lastScrollAt = Date.now(), scrollBurst = 0;
  window.addEventListener('scroll', function () {
    var y = window.scrollY, now = Date.now(), dy = Math.abs(y - lastY);
    if (now - lastScrollAt < 520 && dy > 850) scrollBurst++; else scrollBurst = 0;
    lastScrollAt = now; lastY = y;
    if (scrollBurst >= 2) { scrollBurst = 0; react('scrollFast'); }
  }, { passive: true });

  // 8.2 逛到哪一段
  if ('IntersectionObserver' in window) {
    var seenSec = {};
    var secObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting || e.intersectionRatio < 0.45) return;
        var id = e.target.id;
        if (seenSec[id]) return;
        seenSec[id] = 1;
        if (REACT[id]) react(id);
      });
    }, { threshold: [0.45] });
    ['top', 'about', 'interests', 'contact'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) secObs.observe(el);
    });
  }

  // 8.3 太久没动静
  var lastAct = Date.now();
  ['mousemove', 'scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true });
  });
  setInterval(function () {
    if (Date.now() - lastAct > 26000) { lastAct = Date.now(); react('idle'); }
  }, 4000);

  // 8.4 鼠标停在她身上 / 连着戳她 / 拖她 / 贴边（用 class 变化侦测，不碰原有逻辑）
  if (pet) {
    pet.addEventListener('pointerenter', function () { react('hover'); });
    new MutationObserver(function () {
      var c = pet.className;
      if (c.indexOf('is-dropping') >= 0) react('drag');
      if (c.indexOf('pet--edge-') >= 0) react('dock');
    }).observe(pet, { attributes: true, attributeFilter: ['class'] });
  }
  var pokeCount = 0, pokeAt = 0;
  if (petBtn) {
    petBtn.addEventListener('click', function () {
      var now = Date.now();
      if (now - pokeAt > 2600) pokeCount = 0;
      pokeAt = now; pokeCount++;
      if (pokeCount >= 3) { pokeCount = 0; react('poke'); }
    });
  }

  // 8.5 离开又回来 / 深夜 / 复制文字 / 开关音乐
  document.addEventListener('visibilitychange', function () { if (!document.hidden) react('away'); });
  (function () {
    var hh = new Date().getHours();
    if (hh >= 22 || hh < 6) setTimeout(function () { react('night', true); }, 9000);
  })();
  document.addEventListener('copy', function () { react('copy'); });
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    if (e.target.closest('#musicToggle') || e.target.closest('.music-toggle')) {
      setTimeout(function () {
        var a = document.getElementById('bgm');
        react(a && !a.paused ? 'musicOn' : 'musicOff');
      }, 500);
    }
  });

})();
