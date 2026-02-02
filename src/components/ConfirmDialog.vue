<template>
  <transition name="dialog-fade">
    <div v-if="visible" class="dialog-overlay" @click="handleMaskClick">
      <div class="dialog-card" @click.stop>
        <div class="dialog-header">
          <span class="icon">{{ type === 'alert' ? 'ℹ' : '?' }}</span>
          <h3>{{ title }}</h3>
        </div>
        
        <div class="dialog-body">
          <p>{{ message }}</p>
        </div>

        <div class="dialog-footer">
          <button v-if="type === 'confirm'" class="btn secondary" @click="handleCancel">
            {{ cancelText }}
          </button>
          <button class="btn primary" @click="handleConfirm">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  type: { type: String, default: 'confirm' }, // 'confirm' or 'alert'
  title: { type: String, default: 'System Notice' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: 'Confirm' },
  cancelText: { type: String, default: 'Cancel' },
  resolve: { type: Function },
  reject: { type: Function },
});

const visible = ref(false);

// 打开动画
const show = () => { visible.value = true; };
// 关闭动画
const hide = () => { visible.value = false; };

const handleConfirm = () => {
  hide();
  setTimeout(() => props.resolve(true), 300); // 等待动画结束
};

const handleCancel = () => {
  hide();
  setTimeout(() => {
    if (props.type === 'confirm') props.resolve(false);
    else props.resolve(true); // Alert 点击取消也算完成
  }, 300);
};

const handleMaskClick = () => {
  // 可选：点击遮罩层是否关闭
  // handleCancel(); 
};

defineExpose({ show, hide });
</script>

<style scoped>
.dialog-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px);
  z-index: 9999; display: flex; align-items: center; justify-content: center;
}

.dialog-card {
  width: 400px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.8);
  display: flex; flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 顶部装饰条，呼应 VisView */
.dialog-card::before {
  content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px;
  background: linear-gradient(90deg, #00d2ff, transparent);
}

.dialog-header {
  padding: 15px 20px;
  border-bottom: 1px solid #30363d;
  display: flex; align-items: center; gap: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.dialog-header .icon { color: #00d2ff; font-weight: bold; font-family: monospace; font-size: 18px; }
.dialog-header h3 { margin: 0; color: #fff; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; }

.dialog-body {
  padding: 25px 20px;
  color: #ccc; font-size: 13px; line-height: 1.6;
  min-height: 60px;
}

.dialog-footer {
  padding: 15px 20px;
  background: #0d1117;
  border-top: 1px solid #30363d;
  display: flex; justify-content: flex-end; gap: 10px;
}

.btn {
  padding: 8px 20px; border-radius: 4px; cursor: pointer;
  font-size: 12px; font-weight: bold; transition: all 0.2s;
  letter-spacing: 0.5px;
}

.btn.primary {
  background: #00d2ff; border: 1px solid #00d2ff; color: #000;
}
.btn.primary:hover {
  background: #fff; border-color: #fff; box-shadow: 0 0 10px rgba(0, 210, 255, 0.4);
}

.btn.secondary {
  background: transparent; border: 1px solid #30363d; color: #888;
}
.btn.secondary:hover {
  border-color: #666; color: #fff; background: rgba(255,255,255,0.05);
}

/* 动画 */
.dialog-fade-enter-active, .dialog-fade-leave-active { transition: opacity 0.3s ease; }
.dialog-fade-enter-from, .dialog-fade-leave-to { opacity: 0; }
.dialog-fade-enter-active .dialog-card { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.dialog-fade-leave-active .dialog-card { animation: popIn 0.3s reverse; }

@keyframes popIn {
  from { transform: scale(0.9) translateY(20px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}
</style>