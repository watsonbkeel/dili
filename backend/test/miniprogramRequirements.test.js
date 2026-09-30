const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const homeWxml = read('miniprogram/pages/home/home.wxml');
const placeJs = read('miniprogram/pages/place/place.js');
const placeWxml = read('miniprogram/pages/place/place.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const favoritesWxml = read('miniprogram/pages/favorites/favorites.wxml');
const favoritesJs = read('miniprogram/pages/favorites/favorites.js');
const historyJs = read('miniprogram/pages/history/history.js');
const historyWxml = read('miniprogram/pages/history/history.wxml');
const lowVisionWxml = read('miniprogram/pages/low-vision-home/low-vision-home.wxml');
const lowVisionJs = read('miniprogram/pages/low-vision-home/low-vision-home.js');
const lowVisionWxss = read('miniprogram/pages/low-vision-home/low-vision-home.wxss');
const lowVisionPlaceWxml = read('miniprogram/pages/low-vision-place/low-vision-place.wxml');
const lowVisionPlaceJs = read('miniprogram/pages/low-vision-place/low-vision-place.js');
const lowVisionPlaceWxss = read('miniprogram/pages/low-vision-place/low-vision-place.wxss');
const mobilityWxml = read('miniprogram/pages/mobility-home/mobility-home.wxml');
const mobilityJs = read('miniprogram/pages/mobility-home/mobility-home.js');
const routesWxml = read('miniprogram/pages/routes/routes.wxml');
const routesJs = read('miniprogram/pages/routes/routes.js');
const routeStoreJs = read('miniprogram/utils/routeStore.js');
const navigationJs = read('miniprogram/utils/navigation.js');
const cameraJs = read('miniprogram/pages/camera/camera.js');
const cameraWxml = read('miniprogram/pages/camera/camera.wxml');
const recognitionJs = read('miniprogram/pages/recognition-result/recognition-result.js');
const recognitionWxml = read('miniprogram/pages/recognition-result/recognition-result.wxml');
const apiJs = read('miniprogram/utils/api.js');
const assistantJs = read('miniprogram/pages/assistant/assistant.js');
const assistantWxml = read('miniprogram/pages/assistant/assistant.wxml');
const assistantWxss = read('miniprogram/pages/assistant/assistant.wxss');
const modeSelectWxml = read('miniprogram/pages/mode-select/mode-select.wxml');
const modeSelectWxss = read('miniprogram/pages/mode-select/mode-select.wxss');

test('normal home exposes AI and no mode button', () => {
  assert.match(homeWxml, /bindtap="openAi">AI 助手/);
  assert.doesNotMatch(homeWxml, /mode-switch|bindtap="changeMode"/);
});

test('normal home uses a real map with Tiananmen default and manual real-location refresh', () => {
  const homeJs = read('miniprogram/pages/home/home.js');
  const homeWxss = read('miniprogram/pages/home/home.wxss');
  assert.match(homeWxml, /<map[\s\S]*latitude="{{latitude}}"[\s\S]*markers="{{markers}}"[\s\S]*bindmarkertap="onMarkerTap"/);
  assert.doesNotMatch(homeWxml, /map-grid|map-pin/);
  assert.match(homeWxml, /bindtap="refreshLocation"/);
  assert.match(homeJs, /DEFAULT_LOCATION = \{[\s\S]*latitude: 39\.90746,[\s\S]*longitude: 116\.39763/);
  assert.match(homeJs, /refreshLocation\(\)[\s\S]*wx\.getLocation\([\s\S]*isHighAccuracy: true/);
  assert.match(homeWxss, /\.home-map\s*{[\s\S]*height: 420rpx/);
});

test('normal mode uses the supplied user avatar image', () => {
  assert.match(modeSelectWxml, /data-mode="normal"[\s\S]*class="simple-icon normal-avatar"/);
  assert.match(modeSelectWxml, /class="normal-avatar-image"[\s\S]*src="\/assets\/images\/normal-user-avatar\.jpeg"/);
  assert.match(modeSelectWxss, /\.normal-avatar-image\s*{[\s\S]*width: 100%;[\s\S]*height: 100%/);
  assert.equal(fs.existsSync(path.join(root, 'miniprogram/assets/images/normal-user-avatar.jpeg')), true);
});

test('mode selector keeps all three choices compact and in the requested order', () => {
  const normalIndex = modeSelectWxml.indexOf('data-mode="normal"');
  const mobilityIndex = modeSelectWxml.indexOf('data-mode="mobility"');
  const lowVisionIndex = modeSelectWxml.indexOf('data-mode="lowVision"');
  assert.ok(normalIndex < mobilityIndex && mobilityIndex < lowVisionIndex);
  assert.match(modeSelectWxml, /class="vision-demo"[\s\S]*故宫博物院[\s\S]*播放 \/ 暂停 \/ 继续/);
  assert.match(modeSelectWxss, /\.simple\s*{[\s\S]*min-height: 138rpx;[\s\S]*box-sizing: border-box;/);
  assert.match(modeSelectWxss, /\.vision-choose\s*{[\s\S]*min-height: 84rpx;/);
});

test('mode selector uses a consistent mobility icon and a larger single-line footer', () => {
  assert.match(modeSelectWxml, /class="simple-icon mobility-icon"[\s\S]*src="\/assets\/icons\/mobility-accessibility\.svg"/);
  assert.doesNotMatch(modeSelectWxml, />♿<\/view>/);
  assert.equal(fs.existsSync(path.join(root, 'miniprogram/assets/icons/mobility-accessibility.svg')), true);
  assert.match(modeSelectWxss, /\.simple\s*{[\s\S]*margin-bottom: 28rpx;/);
  assert.match(modeSelectWxss, /\.mode-footer\s*{[\s\S]*font-size: 25rpx;[\s\S]*white-space: nowrap;/);
});

test('place uses one play-pause-resume control and concise AI copy', () => {
  assert.match(placeWxml, /bindtap="toggleSummaryAudio"/);
  assert.doesNotMatch(placeWxml, /停止|继续追问 AI/);
  assert.match(placeWxml, /bindtap="openAi">问 AI/);
  assert.match(placeWxml, /class="btn" bindtap="openNavigation">导航到这里/);
  assert.match(placeWxml, /class="btn primary" bindtap="openAi">问 AI/);
});

test('place exposes heart favorite state and exclusive reaction counts', () => {
  assert.match(placeWxml, /class="favorite-heart">♥<\/text>/);
  assert.match(placeWxml, /favorite \? '已收藏' : '待收藏'/);
  assert.match(placeWxml, /reaction == 'recommend' \? 'selected'/);
  assert.match(placeWxml, /reactionCounts\.recommend/);
  assert.match(placeWxml, /reactionCounts\.notRecommend/);
  assert.match(placeJs, /previous === selected \? '' : selected/);
  assert.match(placeJs, /api\.updatePlaceReaction/);
});

test('place action buttons keep stable three-and-two-column rows on real devices', () => {
  const placeWxss = read('miniprogram/pages/place/place.wxss');
  assert.match(placeWxss, /\.feature-grid\s*{[\s\S]*display: flex;[\s\S]*align-items: stretch;/);
  assert.match(placeWxss, /\.feature-btn\s*{[\s\S]*width: 0;[\s\S]*margin: 0;[\s\S]*flex: 1;[\s\S]*white-space: nowrap;/);
  assert.match(placeWxss, /\.reaction-grid\s*{[\s\S]*display: flex;[\s\S]*align-items: stretch;/);
  assert.match(placeWxss, /\.reaction-btn\s*{[\s\S]*width: 0;[\s\S]*margin: 0;[\s\S]*flex: 1;/);
  assert.doesNotMatch(placeWxss, /@media\s*\(max-width: 360px\)[\s\S]*primary-feature-grid/);
});

test('favorites are grouped by city and support immediate removal', () => {
  assert.match(favoritesWxml, /wx:for="{{groups}}"[\s\S]*{{group\.city}}/);
  assert.match(favoritesWxml, /catchtap="remove"[\s\S]*快速删除/);
  assert.match(favoritesWxml, /class="favorite-card" bindtap="openPlace" data-id="{{item\.id}}"/);
  assert.match(favoritesJs, /favorites\.groupFavoritesByCity\(items\)/);
  assert.match(favoritesJs, /favorites\.removeFavorite/);
});

test('viewed places are recorded locally and reopen with a navigable back stack', () => {
  assert.match(placeJs, /viewHistory\.recordPlaceView\(payload\.place\)/);
  assert.match(lowVisionPlaceJs, /viewHistory\.recordPlaceView\(place\)/);
  assert.match(profileJs, /historyCount: viewHistory\.listHistory\(\)\.length/);
  assert.match(historyWxml, /class="history-card" bindtap="openPlace" data-id="{{item\.id}}"/);
  assert.match(historyWxml, /{{item\.viewedText}}/);
  assert.match(historyJs, /nav\.openPlace\(event\.currentTarget\.dataset\.id\)/);
  assert.match(navigationJs, /function openPlace[\s\S]*wx\.navigateTo/);
});

test('place can add to any selected route or create a new route', () => {
  assert.match(placeWxml, /radio-group[\s\S]*wx:for="{{routeOptions}}"/);
  assert.match(placeWxml, /bindtap="toggleCreateRoute"[\s\S]*bindtap="createRoute"/);
  assert.match(placeJs, /routeStore\.addRoute\(this\._routeState, name\)/);
  assert.match(placeJs, /routeStore\.addStop\(this\._routeState, this\.data\.selectedRouteId/);
  assert.doesNotMatch(placeJs, /pendingRoutePlace/);
});

test('profile keeps favorites but removes unused settings', () => {
  assert.match(profileWxml, /bindtap="openFavorites"><text>我的收藏/);
  assert.doesNotMatch(profileWxml, /隐私与授权|帮助反馈/);
  assert.doesNotMatch(profileWxml, /我的路线|我的线路/);
});

test('mode exits share a redirect-to-selector helper', () => {
  assert.match(navigationJs, /function openModeSelect[\s\S]*wx\.redirectTo/);
  assert.match(lowVisionJs, /changeMode\(\)[\s\S]*nav\.openModeSelect\(\)/);
  assert.match(mobilityJs, /changeMode\(\)[\s\S]*nav\.openModeSelect\(\)/);
});

test('mobility shortcuts show their corresponding page content', () => {
  assert.match(mobilityWxml, /bindtap="openShortRoute"[\s\S]*找少步行路线/);
  assert.match(mobilityWxml, /bindtap="openAccessiblePlaces"[\s\S]*找无障碍景点/);
  assert.match(mobilityJs, /openShortRoute\(\)[\s\S]*#short-routes/);
  assert.match(mobilityJs, /openAccessiblePlaces\(\)[\s\S]*#accessible-places/);
  assert.doesNotMatch(mobilityJs, /openShortRoute\(\)\s*{[^}]*redirectTo/);
});

test('mobility shortcut cards remain a three-column row on narrow real devices', () => {
  const mobilityWxss = read('miniprogram/pages/mobility-home/mobility-home.wxss');
  assert.match(mobilityWxss, /\.mh-feature-grid\s*{[\s\S]*display: flex;[\s\S]*align-items: stretch;/);
  assert.match(mobilityWxss, /\.mh-feature\s*{[\s\S]*width: 0;[\s\S]*min-width: 0;[\s\S]*flex: 1;/);
  assert.doesNotMatch(mobilityWxss, /@media\s*\(max-width: 360px\)[\s\S]*\.mh-feature-grid/);
});

test('mobility home uses demo location until a manual real-location refresh', () => {
  assert.match(mobilityJs, /DEMO_LOCATION = \{[\s\S]*lat: 39\.90746,[\s\S]*lng: 116\.39763/);
  assert.match(mobilityJs, /onLoad\(\)[\s\S]*this\.loadPlaces\(DEMO_LOCATION\)/);
  assert.match(mobilityJs, /refreshLocation\(\)[\s\S]*wx\.getLocation\([\s\S]*type: 'gcj02'[\s\S]*isHighAccuracy: true/);
  assert.match(mobilityWxml, /当前位置：{{locationLabel}}/);
  assert.match(mobilityWxml, /演示定位|locationSourceText/);
  assert.match(mobilityWxml, /<map[\s\S]*latitude="{{location\.lat}}"[\s\S]*markers="{{markers}}"[\s\S]*bindmarkertap="onMarkerTap"/);
  assert.match(mobilityJs, /usingRealLocation: false/);
  assert.match(mobilityJs, /success: \(result\) => \{[\s\S]*usingRealLocation: true/);
});

test('mobility home renders accessible and short-walk recommendations as place cards', () => {
  assert.match(mobilityJs, /sortAccessiblePlaces\(places\)/);
  assert.match(mobilityJs, /sortShortWalkPlaces\(places\)/);
  assert.match(mobilityWxml, /wx:for="{{visibleAccessiblePlaces}}"[\s\S]*查看无障碍信息/);
  assert.match(mobilityWxml, /wx:for="{{visibleShortWalkPlaces}}"[\s\S]*查看景点详情/);
  assert.match(mobilityWxml, /{{item\.walkingTimeText}}/);
  assert.doesNotMatch(mobilityWxml, /天安门东站 →|附近 3 个休息点/);
});

test('place always shows walking time and limits accessibility details to mobility mode', () => {
  assert.match(placeWxml, /{{place\.distanceText}} · {{place\.walkingTimeText}}/);
  assert.match(placeWxml, /mode == 'mobility' && place\.accessibility/);
  assert.match(placeWxml, /place\.accessibility\.mapUrl/);
  assert.match(placeJs, /wx\.previewImage\(/);
});

test('low-vision mode has no bottom navigation', () => {
  assert.equal((lowVisionWxml.match(/class="nav-item/g) || []).length, 0);
  assert.doesNotMatch(lowVisionWxml, /bottom-nav|>首页<|>拍照<|>路线<|>我的</);
});

test('low-vision home keeps mode switching visible while scrolling', () => {
  assert.match(lowVisionWxml, /class="lv-mode-switch" bindtap="changeMode">切换模式/);
  assert.match(lowVisionWxml, /padding-top: {{headerTopPadding}}px/);
  assert.match(lowVisionWxml, /class="lv-header-placeholder" style="height: {{headerHeight}}px;"/);
  assert.match(lowVisionWxss, /\.lv-fixed-header\s*{[\s\S]*position: fixed/);
  assert.match(lowVisionJs, /wx\.getMenuButtonBoundingClientRect\(\)/);
  assert.match(lowVisionJs, /changeMode\(\)[\s\S]*nav\.openModeSelect\(\)/);
});

test('mode selection is the launch page and remembers the selected mode', () => {
  const appConfig = JSON.parse(read('miniprogram/app.json'));
  const modeSelectJs = read('miniprogram/pages/mode-select/mode-select.js');
  const userModeJs = read('miniprogram/utils/userMode.js');
  assert.equal(appConfig.pages[0], 'pages/mode-select/mode-select');
  assert.match(modeSelectJs, /savedMode && options\.force !== '1'/);
  assert.match(modeSelectWxml, /wx:if="{{pageReady}}"/);
  assert.match(modeSelectJs, /savedMode && options\.force !== '1'[\s\S]*wx\.reLaunch\([\s\S]*return;/);
  assert.match(modeSelectJs, /userMode\.setMode\(mode\)/);
  assert.match(navigationJs, /function goHome[\s\S]*userMode\.homeUrlForMode\(mode\)[\s\S]*wx\.reLaunch/);
  assert.match(userModeJs, /wx\.setStorageSync\(MODE_KEY, mode\)/);
});

test('low-vision attractions open the dedicated text-only detail page', () => {
  assert.match(lowVisionWxml, /class="lv-place" bindtap="openPlace" data-id="{{item\.id}}"/);
  assert.match(lowVisionJs, /pages\/low-vision-place\/low-vision-place\?id=/);
  assert.doesNotMatch(lowVisionPlaceWxml, /<image\b/);
  assert.match(lowVisionPlaceWxml, /class="back-btn" bindtap="goBack">返回/);
  assert.match(lowVisionPlaceWxss, /\.lv-detail-nav\s*{[\s\S]*position: fixed/);
  assert.match(lowVisionPlaceWxml, /class="nav-placeholder" style="height: {{navigationHeight}}px;"/);
});

test('low-vision detail automatically speaks and supports voice AI questions', () => {
  assert.match(lowVisionPlaceJs, /this\.speech\.play\(introductionText\(place, sections\)\)/);
  assert.match(lowVisionPlaceJs, /SILENCE_TIMEOUT_MS = 3000/);
  assert.match(lowVisionPlaceJs, /api\.transcribeAudio\(filePath\)/);
  assert.match(lowVisionPlaceJs, /api\.askAssistant\(/);
  assert.match(lowVisionPlaceJs, /if \(answer && this\.speech\) this\.speech\.play\(answer\)/);
  assert.match(lowVisionPlaceWxml, /'问 AI'/);
});

test('low-vision home provides bottom voice attraction search', () => {
  assert.match(lowVisionWxml, /语音搜索/);
  assert.match(lowVisionWxml, /{{searchStatus}}/);
  assert.match(lowVisionWxml, /<text wx:else>开始<\/text>/);
  assert.match(lowVisionWxml, /class="lv-search-result" bindtap="openPlace"/);
  assert.match(lowVisionWxml, /id="voice-search-results" class="lv-search-results"/);
  assert.match(lowVisionWxml, /class="lv-voice-dock"/);
  assert.match(lowVisionWxss, /\.lv-voice-dock\s*{[\s\S]*position: fixed;[\s\S]*bottom: 0;[\s\S]*z-index: 25;/);
  assert.match(lowVisionWxss, /\.lv-page\s*{[\s\S]*padding: 0 30rpx calc\(430rpx \+ env\(safe-area-inset-bottom\)\);/);
  assert.ok(lowVisionWxml.indexOf('id="voice-search-results"') < lowVisionWxml.indexOf('class="lv-voice-dock"'));
  assert.match(lowVisionJs, /SILENCE_TIMEOUT_MS = 3000/);
  assert.match(lowVisionJs, /MAX_RECORDING_MS = 60000/);
  assert.match(lowVisionJs, /api\.transcribeAudio\(filePath\)/);
  assert.match(lowVisionJs, /matchPlaces\(query, this\.data\.places/);
  assert.match(lowVisionJs, /pageScrollTo\(\{ selector: '#voice-search-results'/);
});

test('low-vision home and detail use consistently enlarged typography', () => {
  assert.match(lowVisionWxss, /\.lv-page\s*{[\s\S]*font-size: 44rpx/);
  assert.match(lowVisionWxss, /\.lv-title\s*{[\s\S]*font-size: 68rpx/);
  assert.match(lowVisionWxss, /\.lv-summary,[\s\S]*\.lv-distance\s*{[\s\S]*font-size: 46rpx/);
  assert.match(lowVisionWxss, /\.lv-main-btn,[\s\S]*\.lv-big-btn\s*{[\s\S]*font-size: 50rpx/);
  assert.match(lowVisionPlaceWxss, /\.lv-detail-page\s*{[\s\S]*font-size: 46rpx/);
  assert.match(lowVisionPlaceWxss, /\.place-name\s*{[\s\S]*font-size: 72rpx/);
  assert.match(lowVisionPlaceWxss, /\.section-line\s*{[\s\S]*font-size: 46rpx/);
  assert.match(lowVisionPlaceWxss, /\.ask-ai-btn\s*{[\s\S]*font-size: 52rpx/);
});

test('low-vision font size selector applies one persisted size across home and detail', () => {
  assert.match(lowVisionWxml, /请选择你的文字大小/);
  assert.match(lowVisionWxml, /data-size="small"[\s\S]*data-size="medium"[\s\S]*data-size="large"/);
  assert.match(lowVisionWxml, /class="lv-page font-{{fontSize}}"/);
  assert.match(lowVisionPlaceWxml, /class="lv-detail-page font-{{fontSize}}"/);
  assert.match(lowVisionJs, /lowVisionPreferences\.setFontSize/);
  assert.match(lowVisionJs, /onShow\(\)[\s\S]*lowVisionPreferences\.getFontSize/);
  assert.match(lowVisionPlaceJs, /onShow\(\)[\s\S]*lowVisionPreferences\.getFontSize/);
  assert.match(lowVisionWxss, /\.font-small[\s\S]*\.font-medium[\s\S]*\.font-large/);
  assert.match(lowVisionPlaceWxss, /\.font-small[\s\S]*\.font-medium[\s\S]*\.font-large/);
});

test('normal and low-vision homes share the same place preparation', () => {
  assert.match(read('miniprogram/pages/home/home.js'), /require\('\.\.\/\.\.\/utils\/placeList'\)/);
  assert.match(lowVisionJs, /require\('\.\.\/\.\.\/utils\/placeList'\)/);
  assert.doesNotMatch(lowVisionJs, /places\.slice/);
});

test('route editor removes stops and recalculates order', () => {
  assert.match(routesWxml, /bindtap="removeStop"/);
  const removeMethod = routesJs.slice(routesJs.indexOf('removeStop(event)'), routesJs.indexOf('openStop(event)'));
  assert.match(removeMethod, /filter\(/);
  assert.match(removeMethod, /withOrder\(stops\)/);
});

test('route editor supports persistent route management and smart sorting', () => {
  assert.match(routesWxml, /mode="selector"[\s\S]*bindchange="switchRoute"/);
  assert.match(routesWxml, /bindtap="startEditName"[\s\S]*bindtap="openCreateModal"[\s\S]*bindtap="deleteCurrentRoute"/);
  assert.match(routesJs, /persistAndRender\(state\)[\s\S]*routeStore\.saveState\(state\)/);
  assert.match(routesJs, /routeStore\.smartSortStops\(this\.data\.stops, origin\)/);
  assert.match(routesJs, /wx\.getLocation\([\s\S]*type: 'gcj02'/);
  assert.match(routeStoreJs, /STORAGE_KEY = 'localHistoryGuideRoutesV1'/);
  assert.match(routeStoreJs, /function addRoute[\s\S]*function deleteRoute[\s\S]*function renameRoute/);
});

test('route editor has no preview action', () => {
  assert.doesNotMatch(routesWxml, /预览路线|previewRoute/);
  assert.doesNotMatch(routesJs, /previewRoute/);
});

test('camera sends the selected image through real AI recognition', () => {
  assert.match(cameraJs, /wx\.compressImage\(/);
  assert.match(cameraJs, /wx\.getLocation\([\s\S]*type: 'gcj02'/);
  assert.match(recognitionJs, /api\.recognizeImage\(this\.data\.image, this\.data\.location\)/);
  assert.match(apiJs, /formData\.latitude = String\(location\.lat\)/);
  assert.match(recognitionWxml, /AI 正在识别/);
  assert.match(recognitionWxml, /已结合当前位置/);
  assert.match(cameraWxml, /AI 将识别当前图片/);
  assert.doesNotMatch(cameraJs, /openDemo/);
  assert.doesNotMatch(recognitionJs, /demoResult/);
});

test('AI assistant displays its source and creates context-specific questions', () => {
  assert.match(assistantWxml, /{{sourceText}}/);
  assert.match(assistantWxml, /{{focusTitle}}/);
  assert.match(assistantWxml, /与当前内容相关的问题/);
  assert.match(assistantJs, /api\.getPlace\(context\.id\)/);
  assert.match(assistantJs, /presentationForContext\(context, place\)/);
  assert.match(placeJs, /name: place\.name/);
  assert.match(placeJs, /summary: place\.summary/);
});

test('AI assistant switches between text and three-second-silence voice input', () => {
  assert.match(assistantWxml, /bindtap="toggleInputMode"/);
  assert.match(assistantWxml, /bindtap="toggleVoiceInput"/);
  assert.match(assistantWxml, /<text wx:if="{{recording}}">停止<\/text>/);
  assert.match(assistantJs, /SILENCE_TIMEOUT_MS = 3000/);
  assert.match(assistantJs, /frameContainsVoice\(event\.frameBuffer\)/);
  assert.match(assistantJs, /api\.transcribeAudio\(filePath\)/);
  assert.match(assistantJs, /audioSource: 'auto'[\s\S]*frameSize: 5/);
  assert.match(lowVisionJs, /audioSource: 'auto'[\s\S]*frameSize: 5/);
  assert.match(lowVisionPlaceJs, /audioSource: 'auto'[\s\S]*frameSize: 5/);
  assert.match(assistantJs, /sendQuestion\(question, \{ fromVoice: true \}\)/);
  assert.match(assistantWxss, /\.input-dock\s*{[\s\S]*position: fixed/);
});

test('each AI answer has one large play-pause-resume control', () => {
  assert.match(assistantWxml, /item\.role === 'assistant'[\s\S]*class="message-audio-btn[\s\S]*bindtap="toggleMessageAudio"[\s\S]*data-index="{{index}}"/);
  assert.match(assistantWxml, /audioMessageIndex === index && audio\.status === 'playing' \? '暂停'/);
  assert.doesNotMatch(assistantWxml, /bindtap="playAnswer"|bindtap="pauseAudio"|bindtap="resumeAudio"|bindtap="stopAudio"|播报最近一条 AI 回复/);
  assert.match(assistantJs, /isCurrentMessage && status === 'playing'[\s\S]*this\.speech\.pause\(\)/);
  assert.match(assistantJs, /isCurrentMessage && status === 'paused'[\s\S]*this\.speech\.resume\(\)/);
  assert.match(assistantJs, /this\.setData\(\{ audioMessageIndex: index \}\)[\s\S]*this\.speech\.play\(message\.content\)/);
  assert.match(assistantWxss, /\.message-audio-btn\s*{[\s\S]*width: 86%;[\s\S]*min-height: 76rpx/);
});
