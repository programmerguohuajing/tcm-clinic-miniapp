truncate table
  commission_settlements,
  commission_rules,
  health_records,
  coupons,
  appointments,
  schedules,
  practitioner_services,
  practitioner_stores,
  practitioners,
  services,
  family_members,
  homepage_configs,
  activities,
  articles,
  reviews,
  admin_audit_logs,
  stores,
  users
restart identity cascade;

insert into users (openid, nickname, phone, member_level, points, admin_role, can_manage)
values
  ('demo-openid-001', '林青禾', '13800000000', '金桂会员', 860, 'owner', true),
  ('demo-openid-002', '周明远', '13900000000', '青竹会员', 210, 'member', false);

insert into stores (name, city, address, phone, business_hours, latitude, longitude, is_default)
values
  ('青囊中医馆·湖滨店', '杭州', '湖滨路 88 号二楼', '0571-88886666', '周一至周日 09:00-21:00', 30.255121, 120.160395, true),
  ('青囊中医馆·城西店', '杭州', '文三西路 168 号', '0571-88990011', '周一至周日 10:00-20:00', 30.286801, 120.103921, false);

insert into family_members (user_id, name, relation, gender, birthday, phone)
values
  (1, '林奶奶', '祖母', 'female', '1953-04-18', '13800000000'),
  (1, '小满', '孩子', 'unknown', '2018-05-21', null);

insert into services (store_id, name, category, description, duration_minutes, price, cover_url, sort_order)
values
  (1, '节气扶阳艾灸', '艾灸调理', '适合手脚冰凉、疲劳困倦与换季养护。', 60, 168, 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=900', 90),
  (1, '肩颈经络疏通', '推拿理疗', '针对伏案久坐、肩颈僵硬、头沉眼胀。', 45, 128, 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=900', 80),
  (1, '体质辨识问诊', '中医问诊', '九种体质测评，生成个性化养生建议。', 30, 99, 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=900', 70),
  (2, '睡眠安神调理', '综合调理', '通过耳穴、头部放松与草本热敷改善睡眠。', 60, 198, 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=900', 60);

insert into practitioners (store_id, name, title, avatar_url, bio, specialties, certificates, rating)
values
  (1, '许安和', '高级中医康复理疗师', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400', '从业十二年，擅长经络调理与慢性疲劳管理。', array['肩颈调理','艾灸','睡眠管理'], '[{"name":"中医康复理疗师证"}]', 4.9),
  (1, '沈知夏', '中医体质调养师', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400', '关注女性体质、节气养生与家庭健康档案管理。', array['体质辨识','药膳建议','女性调理'], '[{"name":"健康管理师"}]', 4.8),
  (2, '闻柏舟', '推拿正骨技师', 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400', '擅长运动损伤恢复、颈肩腰腿痛调理。', array['推拿','正骨','运动恢复'], '[{"name":"保健按摩师"}]', 4.7);

insert into practitioner_stores (practitioner_id, store_id, is_primary)
values (1, 1, true), (2, 1, true), (3, 2, true);

insert into practitioner_services (practitioner_id, service_id)
values
  (1, 1), (1, 2), (1, 4),
  (2, 1), (2, 3), (2, 4),
  (3, 2), (3, 4);

insert into schedules (store_id, practitioner_id, work_date, start_time, end_time, capacity, status)
select p.store_id, p.id, d::date, t.start_time::time, t.end_time::time, 2, 'open'
from practitioners p
cross join generate_series(current_date, current_date + interval '9 days', interval '1 day') d
cross join (values ('09:30','10:30'), ('11:00','12:00'), ('14:00','15:00'), ('15:30','16:30')) as t(start_time, end_time);

insert into activities (store_id, title, subtitle, cover_url, price, original_price, tag, starts_at, ends_at, sort_order)
values
  (1, '芒种祛湿调理周', '艾灸 + 草本热敷，给身体开一扇透气的窗。', 'https://images.unsplash.com/photo-1505577058444-a3dab90d4253?w=900', 199, 298, '节气限定', now(), now() + interval '14 days', 100),
  (1, '新客体质辨识礼', '首单 39 元建立个人健康画像。', 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900', 39, 99, '新客专享', now(), now() + interval '30 days', 80),
  (2, '家庭肩颈守护卡', '3 次肩颈疏通，可给家人代约。', 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=900', 299, 384, '家庭共享', now(), now() + interval '21 days', 70);

insert into articles (store_id, title, summary, content, cover_url, category, read_minutes, status, published_at)
values
  (1, '芒种后为什么容易困重？', '湿热渐盛，饮食与作息都要给脾胃留余地。', '少甜腻，多清淡，午后可按揉阴陵泉与足三里。', 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=900', '节气养生', 4, 'published', now() - interval '1 day'),
  (1, '三个适合办公室的肩颈穴位', '风池、肩井、后溪，久坐人群可以这样安排。', '每次按揉 30 秒，酸胀即可，不追求疼痛。', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900', '穴位保健', 3, 'published', now() - interval '3 days'),
  (2, '夏季药膳：陈皮茯苓薏米水', '清爽但不寒凉，适合湿困与食欲一般的人群。', '孕期、慢病人群请先咨询医师。', 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900', '药膳食谱', 2, 'published', now() - interval '5 days');

insert into coupons (user_id, title, amount, min_spend, status, expires_at)
values
  (1, '新客调理券', 30, 99, 'unused', now() + interval '20 days'),
  (1, '邀请好友奖励券', 50, 199, 'unused', now() + interval '45 days');

insert into health_records (user_id, constitution, symptoms, tongue_image_url, pulse_note, diagnosis_note)
values
  (1, '气虚夹湿', array['易困倦','饭后腹胀','手脚偏凉'], null, '脉象偏缓，需线下复核。', '建议先做 2 周健脾祛湿调理，配合早睡与轻运动。');

insert into reviews (appointment_id, user_id, practitioner_id, store_id, rating, content, reply, status)
values
  (1, 1, 1, 1, 5, '环境很安静，艾灸后肩背轻松了不少。', '感谢认可，后续可继续搭配节气调理。', 'visible'),
  (2, 1, 1, 1, 4, '技师手法专业，预约确认也很及时。', null, 'visible');

insert into commission_rules (name, service_id, threshold_amount, rate)
values
  ('基础项目提成', null, 0, 0.18),
  ('高客单调理提成', 4, 1000, 0.24);

insert into homepage_configs (store_id, section_key, title, payload, sort_order)
values
  (1, 'hero', '湖滨店首页主视觉', '{"headline":"节气调理，给身体留一间安静茶室","image":"https://images.unsplash.com/photo-1505577058444-a3dab90d4253?w=1200","button":"立即预约"}', 100),
  (1, 'quick_nav', '首页快捷入口', '{"items":["门店预约","优惠券","健康档案","家人代约"]}', 90),
  (2, 'hero', '城西店首页主视觉', '{"headline":"睡眠与肩颈专项调理","image":"https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1200","button":"查看项目"}', 100);
