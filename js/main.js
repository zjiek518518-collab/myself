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

    // 桌宠：打个招呼，然后开始自己溜达
    if (pet) pet.removeAttribute('inert');
    petSay('欢迎回来，这里的风很轻。', 4200);
    scheduleWander(6000);
    scheduleChat(22000);
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
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

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
    if (open) pausedUntil = Date.now() + 15000;   // 菜单开着的时候先别乱跑
  }

  /* ---------- 说话 ---------- */
  var speechTimer = 0;
  var lastSpokeAt = 0;

  function petSay(text, ms) {
    if (!petSpeech || !text) return;
    petSpeech.textContent = text;
    petSpeech.classList.add('is-show');
    lastSpokeAt = Date.now();
    clearTimeout(speechTimer);
    var dur = ms || Math.min(9000, 2600 + text.length * 180);
    speechTimer = setTimeout(function () {
      petSpeech.classList.remove('is-show');
    }, dur);
  }

  // 隔一阵自己嘀咕一句（正在说话 / 开着菜单时不说）
  var chatTimer = 0;
  function scheduleChat(delay) {
    clearTimeout(chatTimer);
    if (reduceMotion) return;
    chatTimer = setTimeout(function () {
      if (entered && !document.hidden && !petMenuIsOpen() && petSpeech &&
          !petSpeech.classList.contains('is-show') && Date.now() - lastSpokeAt > 8000) {
        petSay(pick(PET_LINES));
      }
      scheduleChat(18000 + Math.random() * 22000);
    }, delay || (16000 + Math.random() * 16000));
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

  function scheduleWander(delay) {
    clearTimeout(wanderTimer);
    if (reduceMotion || !pet) return;
    wanderTimer = setTimeout(wanderStep, delay || (7000 + Math.random() * 9000));
  }

  function wanderStep() {
    if (!pet || walking || !entered || document.hidden || petMenuIsOpen() || Date.now() < pausedUntil) {
      scheduleWander(5000);
      return;
    }
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var home = petHome();
    var h = pet.offsetHeight || 140;

    // 横向随便走，纵向只在她「家」附近小幅浮动，不会跑到内容中间
    var targetLeft = 8 + Math.random() * Math.max(1, vw - home.w - 16);
    var targetBottom = Math.min(
      Math.max(home.bottom + (Math.random() - 0.5) * 90, 8),
      Math.max(8, vh - h - 8)
    );

    var dx = (targetLeft - home.left) - walkX;
    var dy = (targetBottom - home.bottom) - walkY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 12) { scheduleWander(4000); return; }

    // 大约 46 px/s，距离越远走得越久
    var dist = Math.sqrt(dx * dx + dy * dy);
    var dur = Math.min(7, Math.max(1.4, dist / 46));

    walkX += dx;
    walkY += dy;
    walking = true;
    pet.classList.add('is-walking');
    pet.classList.toggle('is-facing-left', dx < 0);
    pet.style.setProperty('--walk-dur', dur.toFixed(2) + 's');
    pet.style.setProperty('--wx', Math.round(walkX) + 'px');
    // walkY 以「向上为正」，而 CSS 的 Y 轴向下为正，所以取负
    pet.style.setProperty('--wy', Math.round(-walkY) + 'px');

    clearTimeout(walkTimer);
    walkTimer = setTimeout(function () {
      walking = false;
      pet.classList.remove('is-walking');
      updatePetFlip();
      if (Math.random() < 0.45 && !petMenuIsOpen()) petSay(pick(PET_WALK_LINES), 2600);
      scheduleWander();
    }, dur * 1000 + 140);
  }

  if (petBtn) {
    petBtn.addEventListener('click', function () {
      // 刚拖完的那一下不算“点击”
      if (pet && pet.dataset.dragged === '1') return;
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
        pet.classList.add('is-dragging');
        openPetMenu(false);
      }
      applyPos(startLeft + dx, startBottom - dy);
      e.preventDefault();
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      pet.classList.remove('is-dragging');
      pet.dataset.dragged = '1';                 // 让紧随其后的 click 不打开菜单
      freezeWalk();
      savePos();
      updatePetFlip();
      pausedUntil = Date.now() + 12000;          // 你放哪儿她就在哪儿待一会儿
      setTimeout(function () { pet.dataset.dragged = '0'; }, 350);
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
    } else if (entered) {
      walking = false;
      if (pet) pet.classList.remove('is-walking');
      scheduleWander(4000);
      scheduleChat(6000);
    }
  });

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
})();
