// ── Auth State ────────────────────────────────────────────

let isGuest = false;
let currentUser = null;

const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginCard = document.getElementById('loginCard');
const signupCard = document.getElementById('signupCard');
const signupForm = document.getElementById('signupForm');
const guestBtn = document.getElementById('guestBtn');
const guestBanner = document.getElementById('guestBanner');
const guestBannerLogin = document.getElementById('guestBannerLogin');

function enterApp(asGuest, user) {
  isGuest = asGuest;
  currentUser = user || null;
  loginScreen.classList.add('hidden');

  if (asGuest) {
    document.body.classList.add('guest-mode');
    guestBanner.classList.add('visible');
  } else {
    document.body.classList.remove('guest-mode');
    guestBanner.classList.remove('visible');
  }

  if (user && !asGuest) {
    const displayName = user.display_name || user.username || '';
    const handle = '@' + (user.username || '');
    document.getElementById('profileName').value = displayName;
    document.getElementById('profileUsername').value = handle;
    if (user.bio !== undefined) document.getElementById('profileBio').value = user.bio;
    localStorage.setItem('tcc_profileName', displayName);
    localStorage.setItem('tcc_profileUsername', handle);
    if (user.bio) localStorage.setItem('tcc_profileBio', user.bio);
  }

  const adminDashboardBtn = document.getElementById('adminDashboardBtn');
  if (adminDashboardBtn) {
    adminDashboardBtn.style.display = user && !asGuest && user.is_staff ? '' : 'none';
  }

  if (typeof loadBoards === 'function') loadBoards();
}

function showLogin() {
  closePanel();
  document.body.classList.remove('guest-mode');
  guestBanner.classList.remove('visible');
  loginScreen.classList.remove('hidden');
  switchToLogin();
  const adminDashboardBtn = document.getElementById('adminDashboardBtn');
  if (adminDashboardBtn) adminDashboardBtn.style.display = 'none';
}

function switchToSignup() {
  loginCard.classList.add('hiding');
  setTimeout(() => {
    loginCard.style.display = 'none';
    loginCard.classList.remove('hiding');
    signupCard.classList.add('active');
  }, 250);
}

function switchToLogin() {
  signupCard.classList.remove('active');
  signupCard.style.display = '';
  loginCard.style.display = '';
  signupForm.reset();
  clearPasswordStrength();
  document.getElementById('confirmError').textContent = '';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('loginUsername').value.trim(),
        password: document.getElementById('loginPassword').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.textContent = data.error || 'Login failed';
      return;
    }
    loginForm.reset();
    enterApp(false, data.user);
  } catch {
    loginError.textContent = 'Cannot reach server — make sure it is running.';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

guestBtn.addEventListener('click', () => {
  enterApp(true, null);
});

guestBannerLogin.addEventListener('click', showLogin);

document.getElementById('showSignup').addEventListener('click', (e) => {
  e.preventDefault();
  switchToSignup();
});

document.getElementById('showLogin').addEventListener('click', (e) => {
  e.preventDefault();
  switchToLogin();
});

// ── Signup Form ───────────────────────────────────────────

const strengthFill = document.getElementById('strengthFill');
const strengthLabel = document.getElementById('strengthLabel');
const signupPassword = document.getElementById('signupPassword');
const signupConfirm = document.getElementById('signupConfirm');
const confirmError = document.getElementById('confirmError');

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 'weak', label: 'Weak' };
  if (score === 2) return { level: 'fair', label: 'Fair' };
  if (score === 3) return { level: 'good', label: 'Good' };
  return { level: 'strong', label: 'Strong' };
}

function clearPasswordStrength() {
  strengthFill.className = 'strength-fill';
  strengthLabel.textContent = '';
}

signupPassword.addEventListener('input', () => {
  const pw = signupPassword.value;
  if (!pw) {
    clearPasswordStrength();
    return;
  }
  const { level, label } = getPasswordStrength(pw);
  strengthFill.className = 'strength-fill ' + level;
  strengthLabel.textContent = label;
  strengthLabel.style.color =
    level === 'weak' ? '#f5576c' :
    level === 'fair' ? '#fa709a' :
    level === 'good' ? '#fee140' : '#43e97b';

  if (signupConfirm.value) validateConfirm();
});

function validateConfirm() {
  if (!signupConfirm.value) {
    confirmError.textContent = '';
    return true;
  }
  if (signupConfirm.value !== signupPassword.value) {
    confirmError.textContent = 'Passwords do not match';
    return false;
  }
  confirmError.textContent = '';
  return true;
}

signupConfirm.addEventListener('input', validateConfirm);

const signupBirthdate = document.getElementById('signupBirthdate');
const birthdateError = document.getElementById('birthdateError');
const MINIMUM_AGE = 18;

function validateBirthdate() {
  const value = signupBirthdate.value;
  if (!value) {
    birthdateError.textContent = 'Date of birth is required';
    return false;
  }
  const dob = new Date(value + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age--;

  if (dob > today) {
    birthdateError.textContent = 'Date of birth is invalid';
    return false;
  }
  if (age < MINIMUM_AGE) {
    birthdateError.textContent = `You must be at least ${MINIMUM_AGE} years old to create an account`;
    return false;
  }
  birthdateError.textContent = '';
  return true;
}

signupBirthdate.addEventListener('change', validateBirthdate);

const captchaError = document.getElementById('captchaError');
const turnstileWidget = document.getElementById('signupTurnstile');

function getTurnstileToken() {
  const input = signupForm.querySelector('[name="cf-turnstile-response"]');
  return input ? input.value : '';
}

function resetTurnstile() {
  if (window.turnstile) window.turnstile.reset(turnstileWidget);
}

function validateCaptcha() {
  if (!getTurnstileToken()) {
    captchaError.textContent = 'Please complete the CAPTCHA';
    return false;
  }
  captchaError.textContent = '';
  return true;
}

signupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateBirthdate()) return;
  if (!validateConfirm()) return;
  if (!validateCaptcha()) return;
  openTermsModal();
});

async function completeRegistration() {
  const signupError = document.getElementById('signupError');
  const signupBtn = document.getElementById('signupBtn');
  signupError.textContent = '';
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account…';

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('signupUsername').value.trim().replace(/^@/, ''),
        display_name: document.getElementById('signupName').value.trim(),
        email: document.getElementById('signupEmail').value.trim(),
        date_of_birth: document.getElementById('signupBirthdate').value,
        password: document.getElementById('signupPassword').value,
        agreed_to_terms: true,
        turnstile_token: getTurnstileToken(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      signupError.textContent = data.error || 'Registration failed';
      resetTurnstile();
      return;
    }
    signupForm.reset();
    clearPasswordStrength();
    confirmError.textContent = '';
    birthdateError.textContent = '';
    captchaError.textContent = '';
    switchToLogin();
    enterApp(false, data.user);
  } catch {
    signupError.textContent = 'Cannot reach server — make sure it is running.';
    resetTurnstile();
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Create Account';
  }
}

// ── Terms and Conditions Modal ─────────────────────────────

const termsModalOverlay = document.getElementById('termsModalOverlay');
const termsAgreeCheckbox = document.getElementById('termsAgreeCheckbox');
const termsAcceptBtn = document.getElementById('termsAcceptBtn');
const termsCancelBtn = document.getElementById('termsCancelBtn');
const termsModalClose = document.getElementById('termsModalClose');

function openTermsModal() {
  termsAgreeCheckbox.checked = false;
  termsAcceptBtn.disabled = true;
  termsModalOverlay.classList.add('open');
}

function closeTermsModal() {
  termsModalOverlay.classList.remove('open');
}

termsAgreeCheckbox.addEventListener('change', () => {
  termsAcceptBtn.disabled = !termsAgreeCheckbox.checked;
});

termsCancelBtn.addEventListener('click', closeTermsModal);
termsModalClose.addEventListener('click', closeTermsModal);
termsModalOverlay.addEventListener('click', (e) => {
  if (e.target === termsModalOverlay) closeTermsModal();
});

termsAcceptBtn.addEventListener('click', () => {
  if (!termsAgreeCheckbox.checked) return;
  closeTermsModal();
  completeRegistration();
});

// ── Randomized Quotes ─────────────────────────────────────
// Quotes are managed by admins (see the admin dashboard) and served from
// the database rather than hardcoded here.

let quotes = [];

function setRandomQuote() {
  const el = document.getElementById('randomQuote');
  if (!el || quotes.length === 0) return;
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    el.style.opacity = '1';
  }, 400);
}

async function loadQuotes() {
  try {
    const res = await fetch('/api/quotes/');
    if (!res.ok) return;
    const data = await res.json();
    quotes = data.quotes || [];
    setRandomQuote();
  } catch {
    // no quotes available — header quote just stays blank
  }
}

loadQuotes();
setInterval(setRandomQuote, 12000);

// ── Panel System ──────────────────────────────────────────

const overlay = document.getElementById('panelOverlay');
const panels = {
  profile: document.getElementById('profilePanel'),
  notif: document.getElementById('notifPanel'),
  about: document.getElementById('aboutPanel'),
  settings: document.getElementById('settingsPanel'),
};

let activePanel = null;

function openPanel(name) {
  if (activePanel) closePanel();
  const panel = panels[name];
  if (!panel) return;
  activePanel = name;
  panel.classList.add('open');
  overlay.classList.add('open');
}

function closePanel() {
  if (!activePanel) return;
  panels[activePanel].classList.remove('open');
  overlay.classList.remove('open');
  activePanel = null;
}

overlay.addEventListener('click', closePanel);

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', closePanel);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const cp = document.getElementById('chatPage');
    if (cp && cp.style.display !== 'none') closeChatPage();
    else closePanel();
  }
});

document.querySelector('.chat-btn').addEventListener('click', () => openChatPage());
document.getElementById('profileBtn').addEventListener('click', () => openPanel('profile'));
document.getElementById('notifBtn').addEventListener('click', () => openPanel('notif'));
document.getElementById('aboutBtn').addEventListener('click', () => openPanel('about'));
document.getElementById('settingsBtn').addEventListener('click', () => openPanel('settings'));

// ── Chat Page (Discord-style) ─────────────────────────────

let activeDm = null;
const chatPage = document.getElementById('chatPage');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = chatPage.querySelector('.send-btn');
const forumWrapper = document.querySelector('.header');
const mainLayout = document.querySelector('.main-layout');
const guestBannerEl = document.getElementById('guestBanner');

const channelDescriptions = {
  'general': 'Talk about whatever',
  'off-topic': 'Anything goes',
  'music': 'Share bangers and hot takes',
  'gaming': 'LFG, clips, and rage',
  'memes': 'If it makes you exhale through your nose',
};

const channelMessages = {
  'general': [],
  'off-topic': [],
  'music': [],
  'gaming': [],
  'memes': [],
};

let currentChannel = 'general';

function openChatPage() {
  forumWrapper.style.display = 'none';
  mainLayout.style.display = 'none';
  guestBannerEl.style.display = 'none';
  chatPage.style.display = 'flex';
  const name = localStorage.getItem('tcc_profileUsername') || localStorage.getItem('tcc_profileName') || 'Comrade';
  document.getElementById('chatUserName').textContent = name.replace(/^@/, '');
  switchChannel('general');
}

function closeChatPage() {
  chatPage.style.display = 'none';
  forumWrapper.style.display = '';
  mainLayout.style.display = '';
  if (isGuest) guestBannerEl.style.display = '';
}

document.getElementById('chatBackBtn').addEventListener('click', closeChatPage);

function switchChannel(name) {
  currentChannel = name;
  document.getElementById('chatChannelName').textContent = name;
  document.getElementById('chatWelcomeChannel').textContent = name;
  document.getElementById('chatChannelDesc').textContent = channelDescriptions[name] || '';
  chatInput.placeholder = 'Message #' + name;

  document.querySelectorAll('.ch-item').forEach(el => {
    el.classList.toggle('active', el.dataset.channel === name);
  });

  renderChannelMessages(name);
}

function renderChannelMessages(name) {
  const msgs = channelMessages[name] || [];
  const welcome = chatMessages.querySelector('.ch-welcome');
  chatMessages.innerHTML = '';
  if (welcome) chatMessages.appendChild(welcome);
  document.getElementById('chatWelcomeChannel').textContent = name;

  let lastUser = null;
  let lastBody = null;

  msgs.forEach(m => {
    const escaped = m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');

    if (m.user === lastUser && lastBody) {
      const p = document.createElement('p');
      p.innerHTML = escaped;
      lastBody.appendChild(p);
      return;
    }

    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.dataset.user = m.user;
    div.innerHTML = `
      <div class="chat-msg-avatar" style="background:${m.color}">${m.user[0]}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-header">
          <strong>${m.user}</strong>
          <span class="chat-msg-time">${m.time}</span>
        </div>
        <p>${escaped}</p>
      </div>
    `;
    chatMessages.appendChild(div);
    lastUser = m.user;
    lastBody = div.querySelector('.chat-msg-body');
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.querySelectorAll('.ch-item[data-channel]').forEach(item => {
  item.addEventListener('click', () => {
    const ch = item.dataset.channel;
    if (ch.startsWith('voice-')) return;
    switchChannel(ch);
  });
});

function getChatTimeStr() {
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return 'Today at ' + (hours % 12 || 12) + ':' + mins + ' ' + ampm;
}

function getChatUsername() {
  return (localStorage.getItem('tcc_profileUsername') || localStorage.getItem('tcc_profileName') || 'You').replace(/^@/, '');
}

function appendChatMsg(username, color, timeStr, text) {
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const lastMsg = chatMessages.querySelector('.chat-msg:last-of-type');
  if (lastMsg && lastMsg.dataset.user === username) {
    const p = document.createElement('p');
    p.innerHTML = escaped;
    lastMsg.querySelector('.chat-msg-body').appendChild(p);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return;
  }
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.dataset.user = username;
  div.innerHTML = `
    <div class="chat-msg-avatar" style="background:${color}">${username[0].toUpperCase()}</div>
    <div class="chat-msg-body">
      <div class="chat-msg-header">
        <strong>${username}</strong>
        <span class="chat-msg-time">${timeStr}</span>
      </div>
      <p>${escaped}</p>
    </div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemMsg(html) {
  const div = document.createElement('div');
  div.className = 'chat-system-msg';
  div.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
    <span class="chat-system-msg-text">${html}</span>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ── YouTube Player ────────────────────────────────────────

let ytPlayer = null;
let ytReady = false;
let ytPendingVideoId = null;
let ytPendingUser = null;
let npInterval = null;

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('ytPlayer', {
    height: '1',
    width: '1',
    playerVars: { autoplay: 0, controls: 0 },
    events: {
      onReady: () => {
        ytReady = true;
        const vol = document.getElementById('npVolume');
        if (vol) ytPlayer.setVolume(parseInt(vol.value, 10));
        if (ytPendingVideoId) {
          playYouTube(ytPendingVideoId, ytPendingUser);
          ytPendingVideoId = null;
          ytPendingUser = null;
        }
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) stopYouTube();
      },
    },
  });
};

function playYouTube(videoId, username) {
  if (!ytReady) {
    ytPendingVideoId = videoId;
    ytPendingUser = username;
    return;
  }

  ytPlayer.loadVideoById(videoId);
  ytPlayer.setVolume(parseInt(document.getElementById('npVolume').value, 10));

  const np = document.getElementById('nowPlaying');
  np.style.display = 'flex';
  document.getElementById('nowPlayingArt').style.backgroundImage =
    'url(https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg)';
  document.getElementById('nowPlayingUser').textContent = username;
  document.getElementById('npPauseIcon').style.display = '';
  document.getElementById('npPlayIcon').style.display = 'none';

  // fetch title — prefer YouTube Data API v3 if key is set, otherwise noembed
  const ytApiKey = localStorage.getItem('tcc_ytApiKey');
  if (ytApiKey) {
    fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + videoId + '&key=' + encodeURIComponent(ytApiKey))
      .then(r => r.json())
      .then(data => {
        if (data.items && data.items.length > 0) {
          const snippet = data.items[0].snippet;
          const title = snippet.title || 'Unknown Track';
          const thumb = snippet.thumbnails?.medium?.url;
          if (thumb) document.getElementById('nowPlayingArt').style.backgroundImage = 'url(' + thumb + ')';
          document.getElementById('nowPlayingTitle').textContent = title;
          appendSystemMsg('<strong>' + username + '</strong> started playing <strong>' + title.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</strong>');
        } else {
          throw new Error('no items');
        }
      })
      .catch(() => fetchTitleFallback(videoId, username));
  } else {
    fetchTitleFallback(videoId, username);
  }

  clearInterval(npInterval);
  npInterval = setInterval(updateNpProgress, 1000);
}

function fetchTitleFallback(videoId, username) {
  fetch('https://noembed.com/embed?url=https://www.youtube.com/watch?v=' + videoId)
    .then(r => r.json())
    .then(data => {
      const title = data.title || 'Unknown Track';
      document.getElementById('nowPlayingTitle').textContent = title;
      appendSystemMsg('<strong>' + username + '</strong> started playing <strong>' + title.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</strong>');
    })
    .catch(() => {
      document.getElementById('nowPlayingTitle').textContent = 'YouTube Audio';
      appendSystemMsg('<strong>' + username + '</strong> started playing a track');
    });
}

function updateNpProgress() {
  if (!ytPlayer || !ytPlayer.getDuration) return;
  const dur = ytPlayer.getDuration();
  const cur = ytPlayer.getCurrentTime();
  if (dur > 0) {
    document.getElementById('npProgressFill').style.width = (cur / dur * 100) + '%';
  }
}

function stopYouTube() {
  if (ytPlayer && ytReady) {
    ytPlayer.stopVideo();
  }
  document.getElementById('nowPlaying').style.display = 'none';
  document.getElementById('npProgressFill').style.width = '0%';
  clearInterval(npInterval);
  appendSystemMsg('Playback stopped.');
}

document.getElementById('npPlayPause').addEventListener('click', () => {
  if (!ytPlayer || !ytReady) return;
  const state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
    document.getElementById('npPauseIcon').style.display = 'none';
    document.getElementById('npPlayIcon').style.display = '';
  } else {
    ytPlayer.playVideo();
    document.getElementById('npPauseIcon').style.display = '';
    document.getElementById('npPlayIcon').style.display = 'none';
  }
});

document.getElementById('npStop').addEventListener('click', stopYouTube);

document.getElementById('npVolume').addEventListener('input', (e) => {
  if (ytPlayer && ytReady) ytPlayer.setVolume(parseInt(e.target.value, 10));
});

// ── Send Message (with /play support) ─────────────────────

function sendMessage() {
  if (isGuest) return;
  const text = chatInput.value.trim();
  if (!text) return;

  const username = getChatUsername();
  const timeStr = getChatTimeStr();
  const color = 'linear-gradient(135deg, var(--accent), #ff6659)';

  // handle /play command
  const playMatch = text.match(/^\/play\s+(.+)$/i);
  if (playMatch) {
    const url = playMatch[1].trim();
    const videoId = extractYouTubeId(url);
    if (videoId) {
      chatInput.value = '';
      appendChatMsg(username, color, timeStr, '/play ' + url);
      channelMessages[currentChannel] = channelMessages[currentChannel] || [];
      channelMessages[currentChannel].push({ user: username, color, time: timeStr, text: '/play ' + url });
      playYouTube(videoId, username);
      return;
    } else {
      chatInput.value = '';
      appendSystemMsg('Invalid YouTube link. Usage: <strong>/play https://youtube.com/watch?v=...</strong>');
      return;
    }
  }

  // handle /stop command
  if (text.toLowerCase() === '/stop') {
    chatInput.value = '';
    stopYouTube();
    return;
  }

  // DM mode
  if (activeDm) {
    const msgData = { user: username, color, time: timeStr, text };
    dmMessages[activeDm] = dmMessages[activeDm] || [];
    dmMessages[activeDm].push(msgData);
    appendChatMsg(username, color, timeStr, text);
    chatInput.value = '';
    return;
  }

  const msgData = { user: username, color, time: timeStr, text };
  channelMessages[currentChannel] = channelMessages[currentChannel] || [];
  channelMessages[currentChannel].push(msgData);
  appendChatMsg(username, color, timeStr, text);
  chatInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── Direct Messages ───────────────────────────────────────

const dmMessages = {};
const dmList = document.getElementById('chDmList');
const dmInputWrap = document.getElementById('chDmInputWrap');
const dmUsernameInput = document.getElementById('chDmUsernameInput');

const dmAvatarColors = [
  '#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#ec407a'
];

function getDmColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return dmAvatarColors[Math.abs(hash) % dmAvatarColors.length];
}

function openDm(username) {
  activeDm = username;
  currentChannel = null;
  if (!dmMessages[username]) dmMessages[username] = [];

  document.querySelectorAll('.ch-item').forEach(el => el.classList.remove('active'));
  renderDmList();

  document.getElementById('chatChannelName').textContent = username;
  document.querySelector('.ch-topbar .ch-hash').textContent = '@';
  document.getElementById('chatChannelDesc').textContent = 'Direct Message';
  chatInput.placeholder = 'Message @' + username;

  const msgs = dmMessages[username];
  const welcome = chatMessages.querySelector('.ch-welcome');
  chatMessages.innerHTML = '';
  if (welcome) {
    welcome.querySelector('h2').innerHTML = 'This is the start of your DM with <strong>' + username + '</strong>';
    welcome.querySelector('p').textContent = 'Messages are only visible to you and ' + username + '.';
    chatMessages.appendChild(welcome);
  }
  document.getElementById('chatWelcomeChannel').textContent = username;

  let lastUser = null;
  let lastBody = null;
  msgs.forEach(m => {
    const escaped = m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    if (m.user === lastUser && lastBody) {
      const p = document.createElement('p');
      p.innerHTML = escaped;
      lastBody.appendChild(p);
      return;
    }
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.dataset.user = m.user;
    div.innerHTML = `
      <div class="chat-msg-avatar" style="background:${m.color}">${m.user[0].toUpperCase()}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-header">
          <strong>${m.user}</strong>
          <span class="chat-msg-time">${m.time}</span>
        </div>
        <p>${escaped}</p>
      </div>
    `;
    chatMessages.appendChild(div);
    lastUser = m.user;
    lastBody = div.querySelector('.chat-msg-body');
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderDmList() {
  dmList.innerHTML = '';
  Object.keys(dmMessages).forEach(name => {
    const color = getDmColor(name);
    const div = document.createElement('div');
    div.className = 'ch-dm-item' + (activeDm === name ? ' active' : '');
    div.dataset.dmUser = name;
    div.innerHTML = `
      <div class="ch-dm-avatar" style="background:${color}">${name[0].toUpperCase()}</div>
      <span>${name}</span>
    `;
    div.addEventListener('click', () => openDm(name));
    dmList.appendChild(div);
  });
}

document.getElementById('chDmNew').addEventListener('click', () => {
  const wrap = dmInputWrap;
  wrap.style.display = wrap.style.display === 'none' ? '' : 'none';
  if (wrap.style.display !== 'none') dmUsernameInput.focus();
});

dmUsernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const name = dmUsernameInput.value.trim();
    if (!name) return;
    dmUsernameInput.value = '';
    dmInputWrap.style.display = 'none';
    if (!dmMessages[name]) dmMessages[name] = [];
    openDm(name);
  }
  if (e.key === 'Escape') {
    dmInputWrap.style.display = 'none';
  }
});

// Override switchChannel to clear DM state
const origSwitchChannel = switchChannel;
switchChannel = function(name) {
  activeDm = null;
  document.querySelector('.ch-topbar .ch-hash').textContent = '#';
  renderDmList();
  origSwitchChannel(name);
};

renderDmList();

// ── Board System ─────────────────────────────────────────

let boardData = {};
let boardIds = {};
let boardColorMap = {};
let boardOrder = [];

async function loadBoards() {
  try {
    const res = await fetch('/api/boards/');
    if (!res.ok) return;
    const { boards } = await res.json();
    boardIds = {};
    boardColorMap = {};
    boardOrder = boards.map((b) => b.name);
    boards.forEach((b) => {
      boardIds[b.name] = b.id;
      boardColorMap[b.name] = b.color;
    });
    renderBoardSidebar();
    await Promise.all(boards.map((b) => refreshBoardPosts(b.name)));
    updateBoardCardCounts();
    renderHomeFeed();
    if (boardView.style.display !== 'none' && boardViewTitle.textContent) {
      renderBoardPosts(boardViewTitle.textContent);
    }
  } catch {
    // server offline — boards stay empty
  }
}

function renderBoardSidebar() {
  const container = document.getElementById('boardCardList');
  if (!container) return;
  container.innerHTML = '';
  boardOrder.forEach((name) => {
    const color = boardColorMap[name] || '#e74c3c';
    const count = (boardData[name] || []).length;
    const card = document.createElement('div');
    card.className = 'board-card';
    card.innerHTML = `
      <div class="board-color" style="background:${color}"></div>
      <div class="board-info"><h3>${escapeHTML(name)}</h3><p>${count} posts</p></div>
    `;
    card.addEventListener('click', () => openBoard(name, color));
    container.appendChild(card);
  });
}

async function refreshBoardPosts(boardName) {
  const boardId = boardIds[boardName];
  if (!boardId) return;
  try {
    const res = await fetch(`/api/boards/${boardId}/posts/`);
    if (!res.ok) return;
    const { posts } = await res.json();
    boardData[boardName] = posts;
  } catch {
    // ignore — keep whatever was cached
  }
}

function updateBoardCardCounts() {
  document.querySelectorAll('.board-card').forEach((card) => {
    const name = card.querySelector('.board-info h3').textContent;
    const count = (boardData[name] || []).length;
    card.querySelector('.board-info p').textContent = count + ' posts';
  });
}

function canDeletePost(post) {
  return !!currentUser && (currentUser.username === post.username || currentUser.is_staff);
}

const feedView = document.getElementById('feedView');
const boardView = document.getElementById('boardView');
const boardViewTitle = document.getElementById('boardViewTitle');
const boardViewColor = document.getElementById('boardViewColor');
const boardPosts = document.getElementById('boardPosts');

const avatarGradients = [
  'linear-gradient(135deg, #e74c3c, #c0392b)',
  'linear-gradient(135deg, #3498db, #2980b9)',
  'linear-gradient(135deg, #2ecc71, #27ae60)',
  'linear-gradient(135deg, #f39c12, #e67e22)',
  'linear-gradient(135deg, #9b59b6, #8e44ad)',
  'linear-gradient(135deg, #1abc9c, #16a085)',
  'linear-gradient(135deg, #ec407a, #d81b60)',
  'linear-gradient(135deg, #ff6659, #e74c3c)',
];

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderBoardPosts(boardName) {
  const posts = boardData[boardName] || [];
  boardPosts.innerHTML = '';
  posts.forEach((p, idx) => {
    if (!p.replies) p.replies = [];
    const grad = avatarGradients[Math.floor(Math.random() * avatarGradients.length)];
    const initial = p.user[0].toUpperCase();
    const replyCount = p.replies.length;
    const post = document.createElement('div');
    post.className = 'post-wrap';
    post.dataset.postId = p.id;
    post.innerHTML = `
      <div class="post">
        <div class="post-avatar" style="background:${grad}">${initial}</div>
        <div class="post-body">
          <div class="post-meta">
            <strong>${escapeHTML(p.user)}</strong>
            <span class="post-time">${escapeHTML(p.time)}</span>
          </div>
          <p>${escapeHTML(p.text)}</p>
          <div class="post-actions">
            <button class="action-btn like-btn${p.liked ? ' liked' : ''}" data-post-id="${p.id}" style="${p.liked ? 'color:#e74c3c' : ''}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span class="like-count">${p.likes}</span>
            </button>
            <button class="action-btn reply-toggle-btn" data-board="${escapeHTML(boardName)}" data-idx="${idx}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="reply-count">${replyCount}</span>
            </button>
            ${canDeletePost(p) ? `
            <button class="action-btn delete-post-btn" data-post-id="${p.id}" title="Delete post">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>` : ''}
          </div>
        </div>
      </div>
      <div class="post-replies" style="display:none">
        <div class="replies-list"></div>
        <div class="reply-input-row">
          <input type="text" class="reply-input" placeholder="Write a reply..." data-board="${escapeHTML(boardName)}" data-idx="${idx}">
          <button class="reply-send-btn" data-board="${escapeHTML(boardName)}" data-idx="${idx}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;

    const repliesList = post.querySelector('.replies-list');
    p.replies.forEach((r) => {
      const rGrad = avatarGradients[Math.floor(Math.random() * avatarGradients.length)];
      const reply = document.createElement('div');
      reply.className = 'reply';
      reply.innerHTML = `
        <div class="reply-avatar" style="background:${rGrad}">${r.user[0].toUpperCase()}</div>
        <div class="reply-body">
          <div class="reply-meta">
            <strong>${escapeHTML(r.user)}</strong>
            <span>${escapeHTML(r.time)}</span>
          </div>
          <p>${escapeHTML(r.text)}</p>
        </div>
      `;
      repliesList.appendChild(reply);
    });

    boardPosts.appendChild(post);
  });
}

async function openBoard(boardName, color) {
  feedView.style.display = 'none';
  boardView.style.display = '';
  boardViewTitle.textContent = boardName;
  boardViewColor.style.background = color;
  renderBoardPosts(boardName);
  await refreshBoardPosts(boardName);
  if (boardViewTitle.textContent === boardName) {
    renderBoardPosts(boardName);
    updateBoardCardCounts();
  }
}

function closeBoard() {
  boardView.style.display = 'none';
  feedView.style.display = '';
}

document.getElementById('boardBackBtn').addEventListener('click', closeBoard);

// toggle replies section
document.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('.reply-toggle-btn');
  if (!toggleBtn) return;
  const postWrap = toggleBtn.closest('.post-wrap');
  if (!postWrap) return;
  const repliesSection = postWrap.querySelector('.post-replies');
  const isOpen = repliesSection.style.display !== 'none';
  repliesSection.style.display = isOpen ? 'none' : '';
  if (!isOpen) {
    const input = repliesSection.querySelector('.reply-input');
    if (input) input.focus();
  }
});

// send reply
async function sendReply(boardName, idx, inputEl) {
  if (isGuest || !currentUser) return;
  const text = inputEl.value.trim();
  if (!text) return;
  const posts = boardData[boardName];
  if (!posts || !posts[idx]) return;

  let res;
  try {
    res = await fetch(`/api/posts/${posts[idx].id}/replies/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    return;
  }
  if (!res.ok) return;
  const { reply } = await res.json();

  if (!posts[idx].replies) posts[idx].replies = [];
  posts[idx].replies.push(reply);
  inputEl.value = '';
  renderBoardPosts(boardName);
  // reopen the replies section for this post
  const allWraps = boardPosts.querySelectorAll('.post-wrap');
  if (allWraps[idx]) {
    const section = allWraps[idx].querySelector('.post-replies');
    if (section) {
      section.style.display = '';
      section.querySelector('.replies-list').scrollTop = section.querySelector('.replies-list').scrollHeight;
    }
  }
  renderHomeFeed();
}

document.addEventListener('click', (e) => {
  const sendBtn = e.target.closest('.reply-send-btn');
  if (!sendBtn) return;
  const boardName = sendBtn.dataset.board;
  const idx = parseInt(sendBtn.dataset.idx, 10);
  const row = sendBtn.closest('.reply-input-row');
  const input = row.querySelector('.reply-input');
  sendReply(boardName, idx, input);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('reply-input')) {
    e.preventDefault();
    const boardName = e.target.dataset.board;
    const idx = parseInt(e.target.dataset.idx, 10);
    sendReply(boardName, idx, e.target);
  }
});


// board composer
document.getElementById('boardPostBtn').addEventListener('click', async () => {
  if (isGuest || !currentUser) return;
  const input = document.getElementById('boardComposerInput');
  const text = input.value.trim();
  if (!text) return;
  const boardName = boardViewTitle.textContent;
  const boardId = boardIds[boardName];
  if (!boardId) return;

  let res;
  try {
    res = await fetch(`/api/boards/${boardId}/posts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {
    return;
  }
  if (!res.ok) return;
  const { post } = await res.json();

  boardData[boardName] = boardData[boardName] || [];
  boardData[boardName].unshift(post);
  renderBoardPosts(boardName);
  input.value = '';
  updateBoardCardCounts();
  renderHomeFeed();
});

// like button toggling
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.like-btn');
  if (!btn || isGuest || !currentUser) return;
  const postId = btn.dataset.postId;
  if (!postId) return;

  let res;
  try {
    res = await fetch(`/api/posts/${postId}/like/`, { method: 'POST' });
  } catch {
    return;
  }
  if (!res.ok) return;
  const { liked, likes } = await res.json();

  const countEl = btn.querySelector('.like-count');
  if (countEl) countEl.textContent = likes;
  btn.classList.toggle('liked', liked);
  btn.style.color = liked ? '#e74c3c' : '';

  const boardName = boardViewTitle.textContent;
  const posts = boardData[boardName] || [];
  const post = posts.find((p) => String(p.id) === String(postId));
  if (post) {
    post.liked = liked;
    post.likes = likes;
  }
});

// delete post — only the owning user or an admin ever sees this button,
// and the server independently enforces the same rule
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.delete-post-btn');
  if (!btn || !currentUser) return;
  const postId = btn.dataset.postId;
  if (!postId) return;
  if (!confirm('Delete this post?')) return;

  let res;
  try {
    res = await fetch(`/api/posts/${postId}/`, { method: 'DELETE' });
  } catch {
    return;
  }
  if (!res.ok) return;

  const boardName = boardViewTitle.textContent;
  if (boardData[boardName]) {
    boardData[boardName] = boardData[boardName].filter((p) => String(p.id) !== String(postId));
  }
  renderBoardPosts(boardName);
  updateBoardCardCounts();
  renderHomeFeed();
});

// ── Profile Page ──────────────────────────────────────────

const profilePage = document.getElementById('profilePage');

const fakeUsers = {};

const fakePosts = {};

function getUserProfile(username) {
  const u = fakeUsers[username];
  if (u) return u;
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#ec407a'];
  const banners = [
    'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
    'linear-gradient(135deg, #2c3e50, #34495e, #5d6d7e)',
    'linear-gradient(135deg, #4a148c, #6a1b9a, #9c27b0)',
  ];
  return {
    color: colors[Math.abs(hash) % colors.length],
    banner: banners[Math.abs(hash) % banners.length],
    bio: '',
    joined: 'Jun 2026',
    posts: Math.abs(hash) % 50,
    followers: Math.abs(hash) % 300,
    following: Math.abs(hash) % 100,
  };
}

let ppPrevPage = null; // track where we came from

function openProfilePage(username, fromPage) {
  ppPrevPage = fromPage || 'forum';

  const isOwn = username === getChatUsername();
  const profile = isOwn ? null : getUserProfile(username);

  const displayName = isOwn ? (localStorage.getItem('tcc_profileName') || username) : username;
  const handle = isOwn ? (localStorage.getItem('tcc_profileUsername') || '@' + username) : '@' + username;
  const bio = isOwn ? (localStorage.getItem('tcc_profileBio') || '') : (profile?.bio || '');
  const color = profile?.color || '#d32f2f';
  const banner = profile?.banner || 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)';
  const joined = profile?.joined || 'Jun 2026';
  const postCount = profile?.posts ?? 0;
  const followers = profile?.followers ?? 0;
  const following = profile?.following ?? 0;

  // banner: use saved image for own profile, or gradient
  const savedBanner = isOwn ? localStorage.getItem('tcc_profileBanner') : null;
  if (savedBanner) {
    profilePage.style.background = 'url(' + savedBanner + ') center/cover no-repeat';
  } else {
    profilePage.style.background = banner;
  }

  document.getElementById('ppDisplayName').textContent = displayName;
  document.getElementById('ppUsername').textContent = handle.startsWith('@') ? handle : '@' + handle;
  document.getElementById('ppBio').textContent = bio;
  document.getElementById('ppJoined').textContent = joined;
  document.getElementById('ppPostCount').textContent = postCount;
  document.getElementById('ppFollowers').textContent = followers;
  document.getElementById('ppFollowing').textContent = following;

  // avatar: use saved image for own profile, or letter
  const avatarEl = document.getElementById('ppAvatar');
  const savedAvatar = isOwn ? localStorage.getItem('tcc_profileAvatar') : null;
  if (savedAvatar) {
    avatarEl.style.background = 'url(' + savedAvatar + ') center/cover no-repeat';
    avatarEl.style.border = '5px solid var(--bg)';
    avatarEl.innerHTML = '';
  } else {
    avatarEl.style.background = color;
    avatarEl.innerHTML = '<span class="pp-avatar-letter">' + username[0].toUpperCase() + '</span>';
  }

  const actionsEl = document.getElementById('ppActions');
  actionsEl.style.display = isOwn ? 'none' : 'flex';

  const followBtn = document.getElementById('ppFollowBtn');
  followBtn.textContent = 'Follow';
  followBtn.classList.remove('following');

  // set active tab to posts
  document.querySelectorAll('.pp-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.pp-tab[data-pptab="posts"]').classList.add('active');
  renderProfileTab('posts', username, color);

  // anthem
  if (isOwn) {
    showPpAnthem();
  } else {
    document.getElementById('ppAnthem').style.display = 'none';
  }

  // hide everything else, show profile page
  forumWrapper.style.display = 'none';
  mainLayout.style.display = 'none';
  guestBannerEl.style.display = 'none';
  chatPage.style.display = 'none';
  profilePage.style.display = 'block';
  profilePage.scrollTop = 0;
}

function closeProfilePage() {
  stopPpAnthem();
  profilePage.style.display = 'none';
  if (ppPrevPage === 'chat') {
    chatPage.style.display = 'flex';
  } else {
    forumWrapper.style.display = '';
    mainLayout.style.display = '';
    if (isGuest) guestBannerEl.style.display = '';
  }
}

function renderProfileTab(tab, username, color) {
  const content = document.getElementById('ppContent');
  content.innerHTML = '';

  if (tab === 'posts') {
    const posts = fakePosts[username];
    if (posts && posts.length > 0) {
      const times = ['2h ago', '5h ago', 'Yesterday', '2d ago', '3d ago'];
      posts.forEach((text, i) => {
        const div = document.createElement('div');
        div.className = 'pp-post';
        div.innerHTML = `
          <div class="pp-post-avatar" style="background:${color}">${username[0].toUpperCase()}</div>
          <div class="pp-post-body">
            <div class="pp-post-meta"><strong>${username}</strong><span>${times[i] || (i + 1) + 'd ago'}</span></div>
            <p>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </div>
        `;
        content.appendChild(div);
      });
    } else {
      content.innerHTML = '<div class="pp-empty">No posts yet.</div>';
    }
  } else if (tab === 'reels') {
    const userReels = reelsData.filter(r => r.user === username);
    if (userReels.length > 0) {
      userReels.forEach(r => {
        const div = document.createElement('div');
        div.className = 'pp-post';
        div.innerHTML = `
          <div class="pp-post-avatar" style="background:${color}">${username[0].toUpperCase()}</div>
          <div class="pp-post-body">
            <div class="pp-post-meta"><strong>${username}</strong><span>Reel</span></div>
            <p>${r.emoji} ${r.caption.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </div>
        `;
        content.appendChild(div);
      });
    } else {
      content.innerHTML = '<div class="pp-empty">No reels yet.</div>';
    }
  } else if (tab === 'likes') {
    content.innerHTML = '<div class="pp-empty">Likes are private.</div>';
  }
}

document.getElementById('ppBackBtn').addEventListener('click', closeProfilePage);

document.querySelectorAll('.pp-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pp-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const username = document.getElementById('ppDisplayName').textContent;
    const color = document.getElementById('ppAvatar').style.background;
    renderProfileTab(tab.dataset.pptab, username, color);
  });
});

document.getElementById('ppFollowBtn').addEventListener('click', () => {
  const btn = document.getElementById('ppFollowBtn');
  if (btn.classList.contains('following')) {
    btn.classList.remove('following');
    btn.textContent = 'Follow';
    const fc = document.getElementById('ppFollowers');
    fc.textContent = parseInt(fc.textContent, 10) - 1;
  } else {
    btn.classList.add('following');
    btn.textContent = 'Following';
    const fc = document.getElementById('ppFollowers');
    fc.textContent = parseInt(fc.textContent, 10) + 1;
  }
});

document.getElementById('ppMsgBtn').addEventListener('click', () => {
  const username = document.getElementById('ppDisplayName').textContent;
  if (!dmMessages[username]) dmMessages[username] = [];
  closeProfilePage();
  openChatPage();
  openDm(username);
});

// click usernames anywhere to open profiles
document.addEventListener('click', (e) => {
  // chat message usernames
  const msgHeader = e.target.closest('.chat-msg-header strong');
  if (msgHeader) {
    const username = msgHeader.textContent;
    openProfilePage(username, chatPage.style.display !== 'none' ? 'chat' : 'forum');
    return;
  }
  // chat member sidebar
  const member = e.target.closest('.ch-member');
  if (member) {
    const name = member.querySelector('.ch-member-info strong')?.textContent;
    if (name) openProfilePage(name, 'chat');
    return;
  }
  // board post usernames
  const postMeta = e.target.closest('.post-meta strong');
  if (postMeta) {
    openProfilePage(postMeta.textContent, 'forum');
    return;
  }
  // profile page post usernames
  const ppMeta = e.target.closest('.pp-post-meta strong');
  if (ppMeta) {
    const name = ppMeta.textContent;
    openProfilePage(name, ppPrevPage);
    return;
  }
});

// escape closes profile page
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && profilePage.style.display !== 'none') {
    closeProfilePage();
    e.stopImmediatePropagation();
  }
});

// ── Reels ─────────────────────────────────────────────────
// Reels is coming as a later feature. Its markup is commented out in
// index.html, so the DOM-dependent code below is disabled to match —
// uncomment both together when the feature is rebuilt.

// Referenced by the profile page's reels tab even while the feature is
// disabled, so it stays live rather than commented out with the rest.
const reelsData = [];

/*
const reelsPage = document.getElementById('reelsPage');
const reelsContainer = document.getElementById('reelsContainer');

let currentReel = 0;
let reelTimer = null;

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

function buildReels() {
  reelsContainer.innerHTML = '';
  reelsData.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'reel ' + (i === 0 ? 'active' : 'below');

    let bgContent = '';
    if (r.mediaURL && r.mediaType === 'video') {
      bgContent = `<video class="reel-media" src="${r.mediaURL}" autoplay muted loop playsinline></video>`;
    } else if (r.mediaURL && r.mediaType === 'image') {
      bgContent = `<img class="reel-media" src="${r.mediaURL}" alt="">`;
    } else {
      bgContent = `<span class="reel-emoji">${r.emoji}</span>`;
    }

    div.innerHTML = `
      <div class="reel-card">
        <div class="reel-bg" style="background:${r.bg}">
          ${bgContent}
        </div>
        <div class="reel-content">
          <div class="reel-user">
            <div class="reel-user-avatar" style="background:${r.color}">${r.user[0].toUpperCase()}</div>
            <div>
              <strong>${r.user}</strong>
            </div>
          </div>
          <div class="reel-caption">${r.caption}</div>
          <div class="reel-sound">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            ${r.sound}
          </div>
        </div>
        <div class="reel-actions">
          <button class="reel-action reel-like-btn" data-index="${i}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span class="reel-like-count">${formatCount(r.likes)}</span>
          </button>
          <button class="reel-action">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${formatCount(r.comments)}</span>
          </button>
          <button class="reel-action">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>${formatCount(r.shares)}</span>
          </button>
        </div>
        <div class="reel-progress">
          ${reelsData.map((_, j) => `<div class="reel-progress-bar ${j < i ? 'viewed' : j === i ? 'current' : ''}"><div class="reel-progress-fill"></div></div>`).join('')}
        </div>
      </div>
    `;
    reelsContainer.appendChild(div);
  });
}

function goToReel(index) {
  if (index < 0 || index >= reelsData.length) return;
  const reels = reelsContainer.querySelectorAll('.reel');
  reels.forEach((r, i) => {
    r.className = 'reel';
    if (i === index) r.classList.add('active');
    else if (i < index) r.classList.add('above');
    else r.classList.add('below');
  });
  currentReel = index;
  updateProgressBars();
  resetReelTimer();
}

function updateProgressBars() {
  reelsContainer.querySelectorAll('.reel-card').forEach((card, cardIdx) => {
    const bars = card.querySelectorAll('.reel-progress-bar');
    bars.forEach((bar, barIdx) => {
      bar.className = 'reel-progress-bar';
      if (barIdx < currentReel) bar.classList.add('viewed');
      else if (barIdx === currentReel) {
        bar.classList.add('current');
        bar.innerHTML = '<div class="reel-progress-fill"></div>';
      }
    });
  });
}

function resetReelTimer() {
  clearTimeout(reelTimer);
  reelTimer = setTimeout(() => {
    if (currentReel < reelsData.length - 1) goToReel(currentReel + 1);
  }, 8000);
}

function openReelsPage() {
  forumWrapper.style.display = 'none';
  mainLayout.style.display = 'none';
  guestBannerEl.style.display = 'none';
  reelsPage.style.display = 'flex';
  currentReel = 0;
  buildReels();
  resetReelTimer();
}

function closeReelsPage() {
  reelsPage.style.display = 'none';
  forumWrapper.style.display = '';
  mainLayout.style.display = '';
  if (isGuest) guestBannerEl.style.display = '';
  clearTimeout(reelTimer);
}

document.getElementById('reelsBtn').addEventListener('click', openReelsPage);
document.getElementById('reelsBackBtn').addEventListener('click', closeReelsPage);
document.getElementById('reelsNext').addEventListener('click', () => goToReel(currentReel + 1));
document.getElementById('reelsPrev').addEventListener('click', () => goToReel(currentReel - 1));

reelsContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.deltaY > 0) goToReel(currentReel + 1);
  else goToReel(currentReel - 1);
}, { passive: false });

let touchStartY = 0;
reelsContainer.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
});
reelsContainer.addEventListener('touchend', (e) => {
  const delta = touchStartY - e.changedTouches[0].clientY;
  if (Math.abs(delta) > 50) {
    if (delta > 0) goToReel(currentReel + 1);
    else goToReel(currentReel - 1);
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.reel-like-btn');
  if (!btn) return;
  const idx = parseInt(btn.dataset.index, 10);
  const countEl = btn.querySelector('.reel-like-count');
  if (btn.classList.toggle('liked')) {
    reelsData[idx].likes++;
    countEl.textContent = formatCount(reelsData[idx].likes);
  } else {
    reelsData[idx].likes--;
    countEl.textContent = formatCount(reelsData[idx].likes);
  }
});

// update escape handler to also close reels / upload modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && reelsPage.style.display !== 'none') {
    const uploadModal = document.getElementById('reelUploadOverlay');
    if (uploadModal && uploadModal.style.display !== 'none') {
      closeReelUpload();
    } else {
      closeReelsPage();
    }
    e.stopImmediatePropagation();
  }
});

// arrow keys for reels navigation
document.addEventListener('keydown', (e) => {
  if (reelsPage.style.display === 'none') return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goToReel(currentReel + 1);
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goToReel(currentReel - 1);
});

// ── Reel Upload ───────────────────────────────────────────

const reelUploadOverlay = document.getElementById('reelUploadOverlay');
const reelFileInput = document.getElementById('reelFileInput');
const reelDropZone = document.getElementById('reelDropZone');
const reelDropPlaceholder = document.getElementById('reelDropPlaceholder');
const reelDropPreview = document.getElementById('reelDropPreview');
const reelPreviewVideo = document.getElementById('reelPreviewVideo');
const reelPreviewImg = document.getElementById('reelPreviewImg');

let uploadedMediaURL = null;
let uploadedMediaType = null; // 'video' or 'image'

function openReelUpload() {
  if (isGuest) return;
  reelUploadOverlay.style.display = 'flex';
  clearReelUpload();
  clearTimeout(reelTimer);
}

function closeReelUpload() {
  reelUploadOverlay.style.display = 'none';
  resetReelTimer();
}

function clearReelUpload() {
  uploadedMediaURL = null;
  uploadedMediaType = null;
  reelDropPreview.style.display = 'none';
  reelDropPlaceholder.style.display = '';
  reelPreviewVideo.style.display = 'none';
  reelPreviewImg.style.display = 'none';
  reelPreviewVideo.src = '';
  reelPreviewImg.src = '';
  reelFileInput.value = '';
  document.getElementById('reelCaption').value = '';
  document.getElementById('reelCharCount').textContent = '0';
  document.getElementById('reelSound').value = '';
  document.querySelectorAll('.reel-emoji-opt').forEach((b, i) => b.classList.toggle('selected', i === 0));
  document.querySelectorAll('.reel-bg-opt').forEach((b, i) => b.classList.toggle('selected', i === 0));
}

function handleReelFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  uploadedMediaURL = url;

  if (file.type.startsWith('video/')) {
    uploadedMediaType = 'video';
    reelPreviewVideo.src = url;
    reelPreviewVideo.style.display = 'block';
    reelPreviewImg.style.display = 'none';
    reelPreviewVideo.play();
  } else {
    uploadedMediaType = 'image';
    reelPreviewImg.src = url;
    reelPreviewImg.style.display = 'block';
    reelPreviewVideo.style.display = 'none';
  }
  reelDropPlaceholder.style.display = 'none';
  reelDropPreview.style.display = 'block';
}

document.getElementById('reelsUploadBtn').addEventListener('click', openReelUpload);
document.getElementById('reelUploadClose').addEventListener('click', closeReelUpload);
document.getElementById('reelUploadCancel').addEventListener('click', closeReelUpload);

reelUploadOverlay.addEventListener('click', (e) => {
  if (e.target === reelUploadOverlay) closeReelUpload();
});

reelDropZone.addEventListener('click', (e) => {
  if (e.target.closest('.reel-remove-media')) return;
  reelFileInput.click();
});

reelFileInput.addEventListener('change', () => {
  handleReelFile(reelFileInput.files[0]);
});

reelDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  reelDropZone.style.borderColor = 'var(--accent)';
});

reelDropZone.addEventListener('dragleave', () => {
  reelDropZone.style.borderColor = '';
});

reelDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  reelDropZone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && (file.type.startsWith('video/') || file.type.startsWith('image/'))) {
    handleReelFile(file);
  }
});

document.getElementById('reelRemoveMedia').addEventListener('click', (e) => {
  e.stopPropagation();
  uploadedMediaURL = null;
  uploadedMediaType = null;
  reelDropPreview.style.display = 'none';
  reelDropPlaceholder.style.display = '';
  reelPreviewVideo.src = '';
  reelPreviewImg.src = '';
  reelFileInput.value = '';
});

document.getElementById('reelCaption').addEventListener('input', (e) => {
  document.getElementById('reelCharCount').textContent = e.target.value.length;
});

document.getElementById('reelEmojiPicker').addEventListener('click', (e) => {
  const opt = e.target.closest('.reel-emoji-opt');
  if (!opt) return;
  document.querySelectorAll('.reel-emoji-opt').forEach(b => b.classList.remove('selected'));
  opt.classList.add('selected');
});

document.getElementById('reelBgPicker').addEventListener('click', (e) => {
  const opt = e.target.closest('.reel-bg-opt');
  if (!opt) return;
  document.querySelectorAll('.reel-bg-opt').forEach(b => b.classList.remove('selected'));
  opt.classList.add('selected');
});

document.getElementById('reelUploadSubmit').addEventListener('click', () => {
  const caption = document.getElementById('reelCaption').value.trim();
  if (!caption && !uploadedMediaURL) return;

  const username = getChatUsername();
  const emoji = document.querySelector('.reel-emoji-opt.selected')?.dataset.emoji || '🔥';
  const bg = document.querySelector('.reel-bg-opt.selected')?.dataset.bg || 'linear-gradient(135deg, #e74c3c, #8e44ad)';
  const sound = document.getElementById('reelSound').value.trim() || 'Original Audio';
  const accentColor = bg.match(/#[a-f0-9]{6}/i)?.[0] || '#e74c3c';

  const newReel = {
    user: username,
    color: accentColor,
    bg: bg,
    emoji: emoji,
    caption: caption || 'No caption',
    sound: sound,
    likes: 0,
    comments: 0,
    shares: 0,
    mediaURL: uploadedMediaURL || null,
    mediaType: uploadedMediaType || null,
  };

  reelsData.unshift(newReel);
  closeReelUpload();
  currentReel = 0;
  buildReels();
  resetReelTimer();
});
*/

// ── Home Feed ─────────────────────────────────────────────

function renderHomeFeed() {
  const container = document.getElementById('homeFeed');
  if (!container) return;
  container.innerHTML = '';

  boardOrder.forEach((name) => {
    const posts = boardData[name];
    if (!posts || posts.length === 0) return;

    const recent = posts.slice(0, 3);
    const color = boardColorMap[name] || '#e74c3c';

    const section = document.createElement('div');
    section.className = 'home-section';

    let postsHTML = '';
    recent.forEach((p) => {
      const grad = avatarGradients[Math.floor(Math.random() * avatarGradients.length)];
      postsHTML += `
        <div class="home-post" data-board="${name}" data-user="${p.user}">
          <div class="home-post-avatar" style="background:${grad}">${p.user[0].toUpperCase()}</div>
          <div class="home-post-body">
            <div class="home-post-meta">
              <strong>${p.user}</strong>
              <span>${p.time}</span>
            </div>
            <p>${p.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
            <div class="home-post-stats">
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${p.likes}</span>
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${p.comments}</span>
            </div>
          </div>
        </div>
      `;
    });

    section.innerHTML = `
      <div class="home-section-header" data-board="${name}" data-color="${color}">
        <div class="home-section-color" style="background:${color}"></div>
        <h3>${name}</h3>
        <span class="home-section-count">${posts.length} posts</span>
      </div>
      ${postsHTML}
    `;
    container.appendChild(section);
  });

  // click section header -> open board
  container.querySelectorAll('.home-section-header').forEach(header => {
    header.addEventListener('click', () => {
      openBoard(header.dataset.board, header.dataset.color);
    });
  });

  // click post -> open that board
  container.querySelectorAll('.home-post').forEach(post => {
    post.addEventListener('click', (e) => {
      // if clicking the username, open profile instead
      if (e.target.closest('.home-post-meta strong')) {
        openProfilePage(post.dataset.user, 'forum');
        return;
      }
      const boardName = post.dataset.board;
      openBoard(boardName, boardColorMap[boardName] || '#e74c3c');
    });
  });
}

renderHomeFeed();

// ── Notification Tabs ─────────────────────────────────────

document.querySelectorAll('.notif-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.notif-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// ── Profile — Save with localStorage + server sync ────────

const profileFields = ['profileName', 'profileUsername', 'profileBio'];

function loadProfile() {
  profileFields.forEach((id) => {
    const el = document.getElementById(id);
    const saved = localStorage.getItem('tcc_' + id);
    if (el && saved) el.value = saved;
  });
}

async function saveProfile() {
  if (isGuest) return;
  profileFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) localStorage.setItem('tcc_' + id, el.value);
  });

  if (currentUser) {
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: document.getElementById('profileName').value.trim(),
          bio: document.getElementById('profileBio').value.trim(),
        }),
      });
    } catch {
      // local save still succeeded; server sync failed silently
    }
  }

  const btn = document.getElementById('saveProfileBtn');
  btn.textContent = 'Saved!';
  btn.classList.add('saved');
  setTimeout(() => {
    btn.textContent = 'Save Profile';
    btn.classList.remove('saved');
  }, 1500);
}

document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
loadProfile();

// ── Profile Avatar & Banner Upload ───────────────────────

const avatarFileInput = document.getElementById('avatarFileInput');
const bannerFileInput = document.getElementById('bannerFileInput');
const profileAvatarLg = document.getElementById('profileAvatarLg');
const profileBannerPreview = document.getElementById('profileBannerPreview');
const avatarRemoveBtn = document.getElementById('avatarRemoveBtn');
const bannerRemoveBtn = document.getElementById('bannerRemoveBtn');

function fileToDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function applyAvatarEverywhere(dataURL) {
  // header avatar
  const headerAvatar = document.querySelector('.profile-btn .avatar');
  if (headerAvatar) {
    if (dataURL) {
      headerAvatar.style.backgroundImage = 'url(' + dataURL + ')';
      headerAvatar.style.backgroundSize = 'cover';
      headerAvatar.style.backgroundPosition = 'center';
      headerAvatar.querySelector('svg').style.display = 'none';
    } else {
      headerAvatar.style.backgroundImage = '';
      headerAvatar.querySelector('svg').style.display = '';
    }
  }
  // chat user bar avatar
  const chatAvatar = document.querySelector('.ch-user-avatar');
  if (chatAvatar) {
    if (dataURL) {
      chatAvatar.style.backgroundImage = 'url(' + dataURL + ')';
      chatAvatar.style.backgroundSize = 'cover';
      chatAvatar.style.backgroundPosition = 'center';
      chatAvatar.querySelector('svg').style.display = 'none';
    } else {
      chatAvatar.style.backgroundImage = '';
      chatAvatar.querySelector('svg').style.display = '';
    }
  }
}

function loadProfileMedia() {
  const avatarData = localStorage.getItem('tcc_profileAvatar');
  if (avatarData) {
    profileAvatarLg.style.backgroundImage = 'url(' + avatarData + ')';
    profileAvatarLg.classList.add('has-image');
    avatarRemoveBtn.style.display = '';
    applyAvatarEverywhere(avatarData);
  }
  const bannerData = localStorage.getItem('tcc_profileBanner');
  if (bannerData) {
    profileBannerPreview.style.backgroundImage = 'url(' + bannerData + ')';
    profileBannerPreview.classList.add('has-image');
    bannerRemoveBtn.style.display = '';
  }
}

// avatar click -> file picker
profileAvatarLg.addEventListener('click', () => avatarFileInput.click());
document.getElementById('avatarUploadBtn').addEventListener('click', () => avatarFileInput.click());

avatarFileInput.addEventListener('change', async () => {
  const file = avatarFileInput.files[0];
  if (!file) return;
  const dataURL = await fileToDataURL(file);
  localStorage.setItem('tcc_profileAvatar', dataURL);
  profileAvatarLg.style.backgroundImage = 'url(' + dataURL + ')';
  profileAvatarLg.classList.add('has-image');
  avatarRemoveBtn.style.display = '';
  applyAvatarEverywhere(dataURL);
});

avatarRemoveBtn.addEventListener('click', () => {
  localStorage.removeItem('tcc_profileAvatar');
  profileAvatarLg.style.backgroundImage = '';
  profileAvatarLg.classList.remove('has-image');
  avatarRemoveBtn.style.display = 'none';
  avatarFileInput.value = '';
  applyAvatarEverywhere(null);
});

// banner click -> file picker
document.getElementById('profileBannerUpload').addEventListener('click', (e) => {
  if (e.target.closest('.profile-media-remove')) return;
  bannerFileInput.click();
});

bannerFileInput.addEventListener('change', async () => {
  const file = bannerFileInput.files[0];
  if (!file) return;
  const dataURL = await fileToDataURL(file);
  localStorage.setItem('tcc_profileBanner', dataURL);
  profileBannerPreview.style.backgroundImage = 'url(' + dataURL + ')';
  profileBannerPreview.classList.add('has-image');
  bannerRemoveBtn.style.display = '';
});

bannerRemoveBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  localStorage.removeItem('tcc_profileBanner');
  profileBannerPreview.style.backgroundImage = '';
  profileBannerPreview.classList.remove('has-image');
  bannerRemoveBtn.style.display = 'none';
  bannerFileInput.value = '';
});

loadProfileMedia();

// ── Profile Anthem ───────────────────────────────────────

const anthemFileInput = document.getElementById('anthemFileInput');
const anthemEmpty = document.getElementById('anthemEmpty');
const anthemPlayerEl = document.getElementById('anthemPlayer');
const anthemPlayBtn = document.getElementById('anthemPlayBtn');
const anthemName = document.getElementById('anthemName');
const anthemBarFill = document.getElementById('anthemBarFill');

let anthemAudio = null;
let anthemInterval = null;

function loadAnthem() {
  const data = localStorage.getItem('tcc_profileAnthem');
  const name = localStorage.getItem('tcc_profileAnthemName');
  if (data && name) {
    anthemEmpty.style.display = 'none';
    anthemPlayerEl.style.display = 'flex';
    anthemName.textContent = name;
    anthemAudio = new Audio(data);
    anthemAudio.loop = true;
    anthemAudio.addEventListener('ended', () => {
      anthemBarFill.style.width = '0%';
    });
  }
}

function updateAnthemBar() {
  if (!anthemAudio || !anthemAudio.duration) return;
  anthemBarFill.style.width = (anthemAudio.currentTime / anthemAudio.duration * 100) + '%';
}

document.getElementById('anthemUpload').addEventListener('click', (e) => {
  if (e.target.closest('.anthem-play-btn') || e.target.closest('.anthem-remove')) return;
  anthemFileInput.click();
});

anthemFileInput.addEventListener('change', async () => {
  const file = anthemFileInput.files[0];
  if (!file) return;
  const dataURL = await fileToDataURL(file);
  localStorage.setItem('tcc_profileAnthem', dataURL);
  localStorage.setItem('tcc_profileAnthemName', file.name);
  if (anthemAudio) { anthemAudio.pause(); clearInterval(anthemInterval); }
  anthemAudio = new Audio(dataURL);
  anthemAudio.loop = true;
  anthemName.textContent = file.name;
  anthemEmpty.style.display = 'none';
  anthemPlayerEl.style.display = 'flex';
  anthemBarFill.style.width = '0%';
  document.getElementById('anthemPlayIcon').style.display = '';
  document.getElementById('anthemPauseIcon').style.display = 'none';
});

anthemPlayBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!anthemAudio) return;
  if (anthemAudio.paused) {
    anthemAudio.play();
    document.getElementById('anthemPlayIcon').style.display = 'none';
    document.getElementById('anthemPauseIcon').style.display = '';
    clearInterval(anthemInterval);
    anthemInterval = setInterval(updateAnthemBar, 250);
  } else {
    anthemAudio.pause();
    document.getElementById('anthemPlayIcon').style.display = '';
    document.getElementById('anthemPauseIcon').style.display = 'none';
    clearInterval(anthemInterval);
  }
});

document.getElementById('anthemRemove').addEventListener('click', (e) => {
  e.stopPropagation();
  if (anthemAudio) { anthemAudio.pause(); clearInterval(anthemInterval); }
  anthemAudio = null;
  localStorage.removeItem('tcc_profileAnthem');
  localStorage.removeItem('tcc_profileAnthemName');
  anthemEmpty.style.display = '';
  anthemPlayerEl.style.display = 'none';
  anthemBarFill.style.width = '0%';
  anthemFileInput.value = '';
});

loadAnthem();

// profile page anthem player
let ppAnthemAudio = null;
let ppAnthemInterval = null;

function showPpAnthem() {
  const data = localStorage.getItem('tcc_profileAnthem');
  const name = localStorage.getItem('tcc_profileAnthemName');
  const el = document.getElementById('ppAnthem');
  if (!data || !name) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  document.getElementById('ppAnthemName').textContent = name.replace(/\.[^.]+$/, '');
  if (ppAnthemAudio) { ppAnthemAudio.pause(); clearInterval(ppAnthemInterval); }
  ppAnthemAudio = new Audio(data);
  ppAnthemAudio.loop = true;
  document.getElementById('ppAnthemBarFill').style.width = '0%';
  document.getElementById('ppAnthemPlayIcon').style.display = '';
  document.getElementById('ppAnthemPauseIcon').style.display = 'none';
}

function stopPpAnthem() {
  if (ppAnthemAudio) { ppAnthemAudio.pause(); clearInterval(ppAnthemInterval); }
  ppAnthemAudio = null;
  document.getElementById('ppAnthemBarFill').style.width = '0%';
}

document.getElementById('ppAnthemPlay').addEventListener('click', () => {
  if (!ppAnthemAudio) return;
  if (ppAnthemAudio.paused) {
    ppAnthemAudio.play();
    document.getElementById('ppAnthemPlayIcon').style.display = 'none';
    document.getElementById('ppAnthemPauseIcon').style.display = '';
    clearInterval(ppAnthemInterval);
    ppAnthemInterval = setInterval(() => {
      if (!ppAnthemAudio || !ppAnthemAudio.duration) return;
      document.getElementById('ppAnthemBarFill').style.width = (ppAnthemAudio.currentTime / ppAnthemAudio.duration * 100) + '%';
    }, 250);
  } else {
    ppAnthemAudio.pause();
    document.getElementById('ppAnthemPlayIcon').style.display = '';
    document.getElementById('ppAnthemPauseIcon').style.display = 'none';
    clearInterval(ppAnthemInterval);
  }
});

// ── Settings — Save with localStorage ────────────────────

const settingToggles = [
  'darkModeToggle',
  'compactToggle',
  'pushNotifToggle',
  'soundToggle',
  'onlineStatusToggle',
  'readReceiptsToggle',
];

function loadSettings() {
  settingToggles.forEach((id) => {
    const el = document.getElementById(id);
    const saved = localStorage.getItem('tcc_' + id);
    if (el && saved !== null) el.checked = saved === 'true';
  });
  applyTheme();
}

function applyTheme() {
  const dark = document.getElementById('darkModeToggle').checked;
  document.body.classList.toggle('light-mode', !dark);
}

settingToggles.forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => {
    localStorage.setItem('tcc_' + id, el.checked);
    if (id === 'darkModeToggle') applyTheme();
  });
});

loadSettings();

// ── YouTube API Key Setting ──────────────────────────────

const ytApiKeyInput = document.getElementById('ytApiKeyInput');
const ytApiKeyStatus = document.getElementById('ytApiKeyStatus');

// load saved key
const savedKey = localStorage.getItem('tcc_ytApiKey');
if (savedKey) ytApiKeyInput.value = savedKey;

document.getElementById('ytApiKeySave').addEventListener('click', () => {
  const key = ytApiKeyInput.value.trim();
  if (!key) {
    localStorage.removeItem('tcc_ytApiKey');
    ytApiKeyStatus.textContent = 'Key removed.';
    ytApiKeyStatus.className = 'setting-key-status success';
    setTimeout(() => { ytApiKeyStatus.textContent = ''; }, 2000);
    return;
  }
  ytApiKeyStatus.textContent = 'Validating...';
  ytApiKeyStatus.className = 'setting-key-status';
  fetch('https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=' + encodeURIComponent(key))
    .then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(data => {
      if (data.items) {
        localStorage.setItem('tcc_ytApiKey', key);
        ytApiKeyStatus.textContent = 'Key saved and verified!';
        ytApiKeyStatus.className = 'setting-key-status success';
      } else {
        throw new Error('invalid');
      }
    })
    .catch(() => {
      ytApiKeyStatus.textContent = 'Invalid key — check it and try again.';
      ytApiKeyStatus.className = 'setting-key-status error';
    });
});

document.getElementById('ytApiKeyToggle').addEventListener('click', () => {
  const isPassword = ytApiKeyInput.type === 'password';
  ytApiKeyInput.type = isPassword ? 'text' : 'password';
  document.getElementById('ytKeyShowIcon').style.display = isPassword ? 'none' : '';
  document.getElementById('ytKeyHideIcon').style.display = isPassword ? '' : 'none';
});

// ── Side Image Gallery ────────────────────────────────────

const sideImageEl = document.getElementById('sideImage');
const sideImageInput = document.getElementById('sideImageInput');
const sideImageAdd = document.getElementById('sideImageAdd');
const sideImageClear = document.getElementById('sideImageClear');
const sideImageCount = document.getElementById('sideImageCount');

let sideImages = JSON.parse(localStorage.getItem('tcc_sideImages') || '[]');
let sideImageIdx = 0;
let sideImageTimer = null;

function saveSideImages() {
  try {
    localStorage.setItem('tcc_sideImages', JSON.stringify(sideImages));
  } catch (e) {
    // localStorage full — silently fail
  }
}

function updateSideImageUI() {
  if (sideImages.length === 0) {
    sideImageEl.style.backgroundImage = '';
    sideImageEl.classList.add('empty');
    sideImageClear.style.display = 'none';
    sideImageCount.style.display = 'none';
    clearInterval(sideImageTimer);
    return;
  }
  sideImageEl.classList.remove('empty');
  sideImageClear.style.display = '';
  sideImageCount.style.display = '';
  sideImageCount.textContent = sideImages.length + ' image' + (sideImages.length === 1 ? '' : 's');
  cycleSideImage();
  clearInterval(sideImageTimer);
  if (sideImages.length > 1) {
    sideImageTimer = setInterval(cycleSideImage, 10000);
  }
}

function cycleSideImage() {
  if (sideImages.length === 0) return;
  sideImageIdx = sideImageIdx % sideImages.length;
  sideImageEl.classList.add('fade-out');
  setTimeout(() => {
    sideImageEl.style.backgroundImage = 'url(' + sideImages[sideImageIdx] + ')';
    sideImageEl.classList.remove('fade-out');
    sideImageIdx = (sideImageIdx + 1) % sideImages.length;
  }, 800);
}

sideImageAdd.addEventListener('click', () => sideImageInput.click());

sideImageInput.addEventListener('change', async () => {
  const files = Array.from(sideImageInput.files);
  for (const file of files) {
    const dataURL = await fileToDataURL(file);
    sideImages.push(dataURL);
  }
  saveSideImages();
  sideImageInput.value = '';
  sideImageIdx = sideImages.length - files.length;
  updateSideImageUI();
});

sideImageClear.addEventListener('click', () => {
  sideImages = [];
  sideImageIdx = 0;
  saveSideImages();
  updateSideImageUI();
});

updateSideImageUI();

// ── Mark All Read ─────────────────────────────────────────

document.getElementById('markAllReadBtn').addEventListener('click', () => {
  const badge = document.querySelector('.notif-badge');
  if (badge) badge.remove();
});

// ── Sign Out ──────────────────────────────────────────────

document.getElementById('signOutBtn').addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch {
    // ignore network errors — still clear local state
  }
  currentUser = null;
  localStorage.removeItem('tcc_profileName');
  localStorage.removeItem('tcc_profileUsername');
  localStorage.removeItem('tcc_profileBio');
  closePanel();
  showLogin();
});

// ── Session check on page load ────────────────────────────

(async function checkSession() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const { user } = await res.json();
      enterApp(false, user);
    }
  } catch {
    // no session or server offline — login screen stays visible
  }
})();
