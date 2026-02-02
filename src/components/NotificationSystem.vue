<template>
  <div class="notification-container">
    <transition-group name="list" tag="div">
      <div 
        v-for="item in items" 
        :key="item.id" 
        class="notify-card"
        :class="item.type"
      >
        <div class="status-stripe"></div>
        
        <div class="content-box">
          <div class="notify-header">
            <span class="icon">{{ getIcon(item.type) }}</span>
            <span class="title">{{ item.title }}</span>
          </div>
          <div class="notify-msg">{{ item.message }}</div>
        </div>

        <button class="close-btn" @click="close(item.id)">×</button>
        
        <div v-if="item.type === 'process'" class="loading-bar"></div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { notificationState, closeNotification } from '../utils/notification';

const items = computed(() => notificationState.items);

const close = (id) => closeNotification(id);

const getIcon = (type) => {
  switch(type) {
    case 'success': return '✓';
    case 'error': return '✕';
    case 'warning': return '⚠';
    case 'process': return '⟳';
    default: return 'ℹ';
  }
};
</script>

<style scoped>
.notification-container {
  /* [修改] 全局固定定位 */
  position: fixed;
  
  /* [修改] 顶部居中 */
  top: 80px; /* 避开各页面的 TopBar (通常高 50-65px) */
  left: 50%;
  transform: translateX(-50%);
  
  width: 360px; /* 稍微加宽一点，居中显示更大气 */
  z-index: 9999; /* 确保在所有图层之上 */
  
  display: flex;
  flex-direction: column;
  gap: 20px;
  pointer-events: none; /* 允许点击穿透空白区域 */
}

.notify-card {
  position: relative;
  background: rgba(16, 20, 28, 0.95); /* 加深背景 */
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5); /* 增强阴影 */
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  pointer-events: auto; /* 恢复卡片点击 */
  padding-right: 30px;
  min-height: 60px;
  
  /* [新增] 居中布局微调 */
  margin: 0 auto;
  width: 100%;
}

/* 状态条颜色 */
.status-stripe { width: 4px; flex-shrink: 0; }
.notify-card.info .status-stripe { background: #00d2ff; box-shadow: 0 0 10px #00d2ff; }
.notify-card.success .status-stripe { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
.notify-card.warning .status-stripe { background: #ffea00; box-shadow: 0 0 10px #ffea00; }
.notify-card.error .status-stripe { background: #ff5252; box-shadow: 0 0 10px #ff5252; }
.notify-card.process .status-stripe { background: #a855f7; box-shadow: 0 0 10px #a855f7; }

.content-box { padding: 12px 15px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.notify-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.icon { font-family: monospace; font-weight: bold; font-size: 14px; }
.notify-card.info .icon { color: #00d2ff; }
.notify-card.success .icon { color: #00ff88; }
.notify-card.warning .icon { color: #ffea00; }
.notify-card.error .icon { color: #ff5252; }
.notify-card.process .icon { color: #a855f7; animation: spin 2s linear infinite; }

.title { font-size: 11px; font-weight: 800; color: #fff; letter-spacing: 1px; text-transform: uppercase; }
.notify-msg { font-size: 12px; color: #ccc; font-family: "Inter", sans-serif; line-height: 1.4; word-break: break-word; }

.close-btn { position: absolute; top: 5px; right: 5px; background: transparent; border: none; color: #666; font-size: 18px; cursor: pointer; line-height: 1; width: 24px; height: 24px; }
.close-btn:hover { color: #fff; }

.loading-bar { position: absolute; bottom: 0; left: 0; height: 2px; background: #a855f7; width: 100%; animation: load 2s infinite ease-in-out; transform-origin: left; }

/* [修改] 动画改为垂直方向 */
.list-move, .list-enter-active, .list-leave-active { transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); }
/* 进入：从上方下落 */
.list-enter-from { opacity: 0; transform: translateY(-20px); }
/* 离开：向上方消失 */
.list-leave-to { opacity: 0; transform: translateY(-20px); }
.list-leave-active { position: absolute; width: 100%; }

@keyframes spin { 100% { transform: rotate(360deg); } }
@keyframes load { 0% { transform: scaleX(0); } 50% { transform: scaleX(0.7); } 100% { transform: scaleX(0); margin-left: 100%; } }
</style>