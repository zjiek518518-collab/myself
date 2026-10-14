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
     4. 杂项
     --------------------------------------------- */
  // 开场期间不让键盘 Tab 进到主内容里
  if (main) main.setAttribute('inert', '');

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

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
