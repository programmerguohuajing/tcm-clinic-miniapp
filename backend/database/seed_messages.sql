insert into messages (user_id, type, title, body, related_id, is_read)
values
  (1, 'appointment_confirmed', '预约已确认', '您的「节气扶阳艾灸」预约（06-15 14:00）已被确认，技师许安和等您到店。', 1, false),
  (1, 'payment_success', '支付成功', '您已完成支付 ¥168.00，订单号 TCM202606120001。', 1, true),
  (1, 'review_reply', '评价收到回复', '技师许安和回复了您的评价：感谢认可，后续可继续搭配节气调理。', 1, false);
