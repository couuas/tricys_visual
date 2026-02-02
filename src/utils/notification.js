// src/utils/notification.js
import { reactive } from 'vue';

// 全局响应式状态
export const notificationState = reactive({
  items: []
});

let idCounter = 0;

/**
 * 发送通知
 * @param {Object} options 配置项
 * @param {string} options.title 标题
 * @param {string} options.message 内容
 * @param {string} options.type 类型: 'info' | 'success' | 'warning' | 'error' | 'process'
 * @param {number} options.duration 持续时间(ms), 0 表示不自动关闭
 * @returns {number} 通知的 ID (用于后续更新或手动关闭)
 */
export const $notify = ({ title, message, type = 'info', duration = 3000 }) => {
  const id = ++idCounter;
  
  const item = {
    id,
    title: title || type.toUpperCase(),
    message: message || '',
    type,
    duration,
    timer: null
  };

  notificationState.items.push(item);

  // 自动关闭逻辑
  if (duration > 0) {
    item.timer = setTimeout(() => {
      closeNotification(id);
    }, duration);
  }

  return id;
};

/**
 * 更新现有通知 (用于仿真计时器更新)
 */
export const $updateNotification = (id, { message, title }) => {
  const item = notificationState.items.find(n => n.id === id);
  if (item) {
    if (message !== undefined) item.message = message;
    if (title !== undefined) item.title = title;
  }
};

/**
 * 关闭通知
 */
export const closeNotification = (id) => {
  const index = notificationState.items.findIndex(n => n.id === id);
  if (index !== -1) {
    const item = notificationState.items[index];
    if (item.timer) clearTimeout(item.timer);
    notificationState.items.splice(index, 1);
  }
};