const { isDev } = require("./env");

const services = [
  {
    id: 1,
    name: "节气扶阳艾灸",
    category: "艾灸调理",
    description: "适合手脚冰凉、疲劳困倦与换季养护。",
    duration_minutes: 60,
    price: "168.00",
    cover_url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=900"
  },
  {
    id: 2,
    name: "肩颈经络疏通",
    category: "推拿理疗",
    description: "针对伏案久坐、肩颈僵硬、头沉眼胀。",
    duration_minutes: 45,
    price: "128.00",
    cover_url: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=900"
  }
];

const practitioners = [
  {
    id: 1,
    name: "许安和",
    title: "高级中医康复理疗师",
    avatar_url: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400",
    bio: "从业十二年，擅长经络调理与慢性疲劳管理。",
    specialties: ["肩颈调理", "艾灸", "睡眠管理"],
    rating: "4.9"
  },
  {
    id: 2,
    name: "沈知夏",
    title: "中医体质调养师",
    avatar_url: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400",
    bio: "关注女性体质、节气养生与家庭健康档案管理。",
    specialties: ["体质辨识", "药膳建议", "女性调理"],
    rating: "4.8"
  }
];

const slots = [
  { id: 1, start_time: "09:30:00", end_time: "10:30:00", available: true, timeLabel: "09:30-10:30" },
  { id: 2, start_time: "11:00:00", end_time: "12:00:00", available: true, timeLabel: "11:00-12:00" },
  { id: 3, start_time: "14:00:00", end_time: "15:00:00", available: true, timeLabel: "14:00-15:00" },
  { id: 4, start_time: "15:30:00", end_time: "16:30:00", available: false, timeLabel: "15:30-16:30" }
];

const activities = [
  {
    id: 1,
    title: "芒种祛湿调理周",
    subtitle: "艾灸 + 草本热敷，给身体开一扇透气的窗。",
    cover_url: "https://images.unsplash.com/photo-1505577058444-a3dab90d4253?w=900",
    price: "199.00",
    original_price: "298.00",
    tag: "节气限定"
  }
];

const articles = [
  {
    id: 1,
    title: "芒种后为什么容易困重？",
    summary: "湿热渐盛，饮食与作息都要给脾胃留余地。",
    cover_url: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=900",
    category: "节气养生",
    read_minutes: 4
  }
];

function getMock(key) {
  if (!isDev()) return [];
  const map = { services, practitioners, slots, activities, articles };
  return map[key] || [];
}

module.exports = {
  activities,
  articles,
  getMock,
  practitioners,
  services,
  slots
};
