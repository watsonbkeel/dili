const test = require('node:test');
const assert = require('node:assert/strict');

const { presentationForContext } = require('../../miniprogram/utils/assistantContext');

test('place assistant presentation names the source and scopes every preset to the place', () => {
  const result = presentationForContext(
    { type: 'place', id: 'beijing-palace-museum' },
    { name: '北京故宫', summary: '明清宫殿建筑群。' }
  );

  assert.equal(result.sourceText, '来源：北京故宫景点详情');
  assert.equal(result.focusTitle, '正在了解：北京故宫');
  assert.match(result.focusDescription, /明清宫殿/);
  assert.equal(result.quickQuestions.length, 4);
  result.quickQuestions.forEach((question) => assert.match(question, /北京故宫/));
});

test('recognition and mobility entries retain distinct source descriptions', () => {
  const recognition = presentationForContext({
    type: 'recognition',
    name: '天坛',
    summary: '识别为天坛祈年殿。'
  });
  const mobility = presentationForContext({ type: 'mode', mode: 'mobility' });

  assert.equal(recognition.sourceText, '来源：拍照识别结果');
  assert.match(recognition.focusTitle, /天坛/);
  assert.equal(mobility.sourceText, '来源：行动不便人士首页');
  assert.match(mobility.focusDescription, /无障碍通行/);
});
