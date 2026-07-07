const seedPlaces = [
  {
    id: 'beijing-palace-museum',
    name: '北京故宫',
    aliases: ['故宫', '紫禁城', '故宫博物院'],
    category: ['古建筑', '博物馆', '世界文化遗产'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区景山前街4号',
    lat: 39.916345,
    lng: 116.397155,
    period: '明清',
    summary: '明清两代皇宫，中国现存规模最大的古代宫殿建筑群之一。',
    timeline: [
      { year: '1406', event: '明成祖朱棣开始营建北京宫城。' },
      { year: '1420', event: '紫禁城基本建成。' },
      { year: '1925', event: '故宫博物院成立。' }
    ],
    images: [{ url: '', caption: '北京故宫建筑群', source: '百度图片' }],
    sources: [{ title: '百度百科：北京故宫', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'temple-of-heaven',
    name: '天坛',
    aliases: ['天坛公园'],
    category: ['古建筑', '坛庙', '世界文化遗产'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区天坛东里甲1号',
    lat: 39.882187,
    lng: 116.406605,
    period: '明清',
    summary: '明清两代皇帝祭天、祈谷的坛庙建筑群，以祈年殿、圜丘坛等建筑著称。',
    timeline: [
      { year: '1420', event: '天地坛建成，后逐渐形成天坛格局。' },
      { year: '1530', event: '明代实行天地分祀后，天地坛改称天坛。' },
      { year: '1998', event: '天坛被列入世界文化遗产名录。' }
    ],
    images: [{ url: '', caption: '天坛祈年殿', source: '百度图片' }],
    sources: [{ title: '百度百科：天坛', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'summer-palace',
    name: '颐和园',
    aliases: ['清漪园'],
    category: ['皇家园林', '世界文化遗产'],
    city: '北京',
    district: '海淀区',
    address: '北京市海淀区新建宫门路19号',
    lat: 39.999972,
    lng: 116.27547,
    period: '清代',
    summary: '以昆明湖、万寿山为主体的清代皇家园林，是中国古典园林的重要代表。',
    timeline: [
      { year: '1750', event: '清漪园开始营建。' },
      { year: '1888', event: '清漪园重建后改称颐和园。' },
      { year: '1998', event: '颐和园被列入世界文化遗产名录。' }
    ],
    images: [{ url: '', caption: '颐和园昆明湖与万寿山', source: '百度图片' }],
    sources: [{ title: '百度百科：颐和园', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'old-summer-palace',
    name: '圆明园遗址',
    aliases: ['圆明园', '圆明园遗址公园'],
    category: ['遗址', '皇家园林'],
    city: '北京',
    district: '海淀区',
    address: '北京市海淀区清华西路28号',
    lat: 40.008102,
    lng: 116.302004,
    period: '清代',
    summary: '清代大型皇家园林遗址，曾由圆明园、长春园、绮春园组成。',
    timeline: [
      { year: '1707', event: '圆明园开始兴建。' },
      { year: '1860', event: '圆明园在第二次鸦片战争中遭劫掠焚毁。' },
      { year: '1988', event: '圆明园遗址公园正式对外开放。' }
    ],
    images: [{ url: '', caption: '圆明园遗址', source: '百度图片' }],
    sources: [{ title: '百度百科：圆明园', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'jingshan-park',
    name: '景山公园',
    aliases: ['景山'],
    category: ['历史园林', '城市中轴线'],
    city: '北京',
    district: '西城区',
    address: '北京市西城区景山西街44号',
    lat: 39.92542,
    lng: 116.396583,
    period: '元明清',
    summary: '位于北京城中轴线上的历史园林，地处故宫北侧，可俯瞰北京中轴线景观。',
    timeline: [
      { year: '明代', event: '景山成为北京宫城北侧的重要皇家苑囿。' },
      { year: '1928', event: '景山辟为公园。' }
    ],
    images: [{ url: '', caption: '景山公园', source: '百度图片' }],
    sources: [{ title: '百度百科：景山公园', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'beihai-park',
    name: '北海公园',
    aliases: ['北海'],
    category: ['皇家园林', '历史园林'],
    city: '北京',
    district: '西城区',
    address: '北京市西城区文津街1号',
    lat: 39.925507,
    lng: 116.389016,
    period: '辽金至明清',
    summary: '北京历史悠久的皇家园林之一，以北海水面、琼华岛和白塔等景观为代表。',
    timeline: [
      { year: '金代', event: '北海一带成为皇家园林的重要组成部分。' },
      { year: '1925', event: '北海公园正式开放。' }
    ],
    images: [{ url: '', caption: '北海白塔', source: '百度图片' }],
    sources: [{ title: '百度百科：北海公园', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'beijing-guozijian',
    name: '国子监',
    aliases: ['北京国子监'],
    category: ['教育遗址', '古建筑'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区国子监街15号',
    lat: 39.94732,
    lng: 116.408381,
    period: '元明清',
    summary: '元、明、清三代国家最高学府和教育管理机构所在地。',
    timeline: [
      { year: '1306', event: '元代开始营建国子监。' },
      { year: '明清', event: '国子监延续作为国家最高学府和教育管理机构。' }
    ],
    images: [{ url: '', caption: '国子监街与辟雍', source: '百度图片' }],
    sources: [{ title: '百度百科：北京国子监', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'beijing-confucius-temple',
    name: '孔庙',
    aliases: ['北京孔庙'],
    category: ['坛庙', '古建筑'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区国子监街13号',
    lat: 39.947013,
    lng: 116.407532,
    period: '元明清',
    summary: '北京祭祀孔子的庙宇，与国子监相邻，是理解传统教育和礼制空间的重要地点。',
    timeline: [
      { year: '1302', event: '北京孔庙始建。' },
      { year: '元明清', event: '长期作为祭祀孔子的礼制场所。' }
    ],
    images: [{ url: '', caption: '北京孔庙', source: '百度图片' }],
    sources: [{ title: '百度百科：北京孔庙', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'yonghe-temple',
    name: '雍和宫',
    aliases: ['雍和宫寺'],
    category: ['寺庙', '古建筑'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区雍和宫大街12号',
    lat: 39.947041,
    lng: 116.417305,
    period: '清代',
    summary: '清代由王府改建而来的藏传佛教寺院，是北京重要的宗教与历史建筑。',
    timeline: [
      { year: '1694', event: '雍亲王府开始形成。' },
      { year: '1744', event: '雍和宫改为藏传佛教寺院。' }
    ],
    images: [{ url: '', caption: '雍和宫建筑', source: '百度图片' }],
    sources: [{ title: '百度百科：雍和宫', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'zhengyangmen',
    name: '正阳门',
    aliases: ['前门'],
    category: ['城门', '古建筑'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区前门大街北端',
    lat: 39.899143,
    lng: 116.397065,
    period: '明清',
    summary: '北京内城南垣正门，由城楼和箭楼等构成，是北京中轴线上的重要城门建筑。',
    timeline: [
      { year: '1419', event: '正阳门始建。' },
      { year: '明清', event: '长期作为北京内城南侧的重要城门。' }
    ],
    images: [{ url: '', caption: '正阳门箭楼', source: '百度图片' }],
    sources: [{ title: '百度百科：正阳门', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'shichahai',
    name: '什刹海',
    aliases: ['什刹海历史文化风景区'],
    category: ['历史街区', '水系景观'],
    city: '北京',
    district: '西城区',
    address: '北京市西城区地安门西大街附近',
    lat: 39.937104,
    lng: 116.386333,
    period: '元明清至近现代',
    summary: '由前海、后海、西海等水域及周边胡同街区组成，是北京老城水系和生活空间的重要片区。',
    timeline: [
      { year: '元代', event: '什刹海一带与大都城市水系关系密切。' },
      { year: '明清', event: '周边形成王府、寺庙、胡同等多层历史空间。' }
    ],
    images: [{ url: '', caption: '什刹海水域与胡同', source: '百度图片' }],
    sources: [{ title: '百度百科：什刹海', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'nanluoguxiang',
    name: '南锣鼓巷',
    aliases: ['南锣'],
    category: ['历史街区', '胡同'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区南锣鼓巷',
    lat: 39.937169,
    lng: 116.403873,
    period: '元明清至近现代',
    summary: '北京老城代表性胡同街区之一，保留了鱼骨状胡同肌理和传统居住街巷格局。',
    timeline: [
      { year: '元代', event: '南锣鼓巷所在区域形成大都坊巷格局。' },
      { year: '近现代', event: '逐渐成为展示北京胡同生活与历史街区更新的代表区域。' }
    ],
    images: [{ url: '', caption: '南锣鼓巷胡同街区', source: '百度图片' }],
    sources: [{ title: '百度百科：南锣鼓巷', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'lugou-bridge',
    name: '卢沟桥',
    aliases: ['芦沟桥', '卢沟桥事变旧址'],
    category: ['桥梁', '抗战遗址', '古建筑'],
    city: '北京',
    district: '丰台区',
    address: '北京市丰台区宛平城西门外',
    lat: 39.849739,
    lng: 116.212681,
    period: '金代至近现代',
    summary: '始建于金代的石桥，也是七七事变相关历史记忆的重要地点。',
    timeline: [
      { year: '1189', event: '卢沟桥开始修建。' },
      { year: '1192', event: '卢沟桥建成。' },
      { year: '1937', event: '卢沟桥事变爆发。' }
    ],
    images: [{ url: '', caption: '卢沟桥石狮与桥面', source: '百度图片' }],
    sources: [{ title: '百度百科：卢沟桥', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'prince-gong-mansion',
    name: '恭王府',
    aliases: ['恭王府博物馆'],
    category: ['王府', '博物馆', '古建筑'],
    city: '北京',
    district: '西城区',
    address: '北京市西城区前海西街17号',
    lat: 39.932351,
    lng: 116.386451,
    period: '清代',
    summary: '清代王府建筑群，包含府邸和花园，是研究清代王府制度和生活空间的重要实例。',
    timeline: [
      { year: '1776', event: '恭王府前身和珅宅第开始形成。' },
      { year: '1851', event: '府邸赐予恭亲王奕䜣，称恭王府。' },
      { year: '2008', event: '恭王府完成修缮后全面开放。' }
    ],
    images: [{ url: '', caption: '恭王府建筑与花园', source: '百度图片' }],
    sources: [{ title: '百度百科：恭王府', url: '' }],
    confidence: 'seed'
  },
  {
    id: 'beijing-ancient-observatory',
    name: '北京古观象台',
    aliases: ['古观象台'],
    category: ['天文遗址', '古建筑'],
    city: '北京',
    district: '东城区',
    address: '北京市东城区建国门南大街2号',
    lat: 39.906575,
    lng: 116.427936,
    period: '明清',
    summary: '明清时期重要的皇家天文观测机构遗存，保存有古代天文仪器。',
    timeline: [
      { year: '1442', event: '北京观象台建成。' },
      { year: '明清', event: '长期承担天文观测和历法相关职能。' }
    ],
    images: [{ url: '', caption: '北京古观象台天文仪器', source: '百度图片' }],
    sources: [{ title: '百度百科：北京古观象台', url: '' }],
    confidence: 'seed'
  }
];

module.exports = { seedPlaces };
