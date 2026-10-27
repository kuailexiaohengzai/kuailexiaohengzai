/**
 * 登录、隐私和可选昵称。
 * wx.login 的 code 只当本地会话标记，没有服务器，换不了 openid。
 * 昵称必须玩家自己点「署名」。接口缺失或拒绝都不挡开局。
 */

const storage = require('./storage.js');

function getWx() {
  return typeof wx !== 'undefined' ? wx : null;
}

function login(api) {
  if (!api || typeof api.login !== 'function') return;
  try {
    api.login({
      success: function (res) {
        if (!res || !res.code || typeof api.setStorageSync !== 'function') return;
        try {
          api.setStorageSync(storage.SESSION_KEY, JSON.stringify({
            code: res.code,
            at: Date.now(),
          }));
        } catch (err) {}
      },
      fail: function () {},
    });
  } catch (err) {}
}

function probePrivacy(api) {
  if (!api || typeof api.getPrivacySetting !== 'function') return;
  try {
    api.getPrivacySetting({
      success: function (res) {
        if (!res || !res.needAuthorization) return;
        if (typeof api.requirePrivacyAuthorize !== 'function') return;
        try {
          api.requirePrivacyAuthorize({
            success: function () {},
            fail: function () {},
            complete: function () {},
          });
        } catch (err) {}
      },
      fail: function () {},
    });
  } catch (err) {}
}

function loadGrantedProfile(api, onNickname) {
  if (!api || typeof api.getSetting !== 'function') return;
  try {
    api.getSetting({
      success: function (res) {
        const granted = res && res.authSetting && res.authSetting['scope.userInfo'] === true;
        if (!granted || typeof api.getUserInfo !== 'function') return;
        api.getUserInfo({
          lang: 'zh_CN',
          withCredentials: false,
          success: function (info) {
            const name = info && info.userInfo && info.userInfo.nickName;
            if (name) onNickname(name);
          },
          fail: function () {},
        });
      },
      fail: function () {},
    });
  } catch (err) {}
}

function hideButton(state) {
  if (!state.button || typeof state.button.hide !== 'function') return;
  try { state.button.hide(); } catch (err) {}
}

function showButton(state) {
  if (!state.button || typeof state.button.show !== 'function') return;
  try { state.button.show(); } catch (err) {}
}

function destroyButton(state) {
  if (state.button && typeof state.button.destroy === 'function') {
    try { state.button.destroy(); } catch (err) {}
  }
  state.button = null;
}

function buttonStyle(layout) {
  const width = 68;
  const height = 28;
  return {
    left: Math.max(8, layout.w - width - 16),
    top: (layout.safeTop || 0) + 12,
    width: width,
    height: height,
    lineHeight: height,
    backgroundColor: '#161222',
    color: '#C9BFFF',
    borderColor: '#7C5CFF',
    borderWidth: 1,
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 14,
  };
}

function createButton(api, state, onNickname) {
  if (!api || typeof api.createUserInfoButton !== 'function' || !state.layout || state.button) return;
  let button = null;
  try {
    button = api.createUserInfoButton({
      type: 'text',
      text: '署名',
      lang: 'zh_CN',
      withCredentials: false,
      style: buttonStyle(state.layout),
    });
  } catch (err) {
    return;
  }
  if (!button || typeof button.onTap !== 'function') return;
  state.button = button;
  try {
    button.onTap(function (res) {
      const info = res && res.userInfo;
      const name = info && info.nickName;
      if (!name) return;
      state.nickname = name;
      onNickname(name);
      hideButton(state);
    });
  } catch (err) {
    destroyButton(state);
    return;
  }
  if (!state.menuVisible) hideButton(state);
}

function syncButton(state) {
  if (!state.button) return;
  if (state.menuVisible && !state.nickname) showButton(state);
  else hideButton(state);
}

function createUserSession(hooks) {
  const api = getWx();
  const onNickname = hooks && hooks.onNickname ? hooks.onNickname : function () {};
  const state = {
    button: null,
    nickname: '',
    layout: null,
    menuVisible: false,
  };

  login(api);
  probePrivacy(api);
  loadGrantedProfile(api, function (name) {
    state.nickname = name;
    onNickname(name);
    hideButton(state);
  });

  return {
    relayout: function (layout) {
      state.layout = layout;
      if (!state.button) return;
      destroyButton(state);
      if (state.menuVisible && !state.nickname) createButton(api, state, onNickname);
    },
    setMenuVisible: function (visible) {
      state.menuVisible = !!visible;
      if (state.menuVisible && !state.nickname && !state.button) {
        createButton(api, state, onNickname);
      }
      syncButton(state);
    },
  };
}

function vibrateLight() {
  const api = getWx();
  if (!api || typeof api.vibrateShort !== 'function') return;
  try {
    api.vibrateShort({
      type: 'light',
      fail: function () {
        try { api.vibrateShort(); } catch (err) {}
      },
    });
  } catch (err) {}
}

module.exports = {
  createUserSession: createUserSession,
  vibrateLight: vibrateLight,
};
