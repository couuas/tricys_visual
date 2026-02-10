<template>
  <div class="kpi-card">
    <div class="card-icon" :class="type">
      <slot name="icon"></slot>
    </div>
    <div class="card-content">
      <div class="kpi-label">{{ label }}</div>
      <div class="kpi-value-row">
        <span class="kpi-value">{{ value }}</span>
        <span class="kpi-unit" v-if="unit">{{ unit }}</span>
      </div>
      <div class="kpi-trend" v-if="trend" :class="trend > 0 ? 'up' : 'down'">
        <span class="trend-arrow">{{ trend > 0 ? '▲' : '▼' }}</span>
        {{ Math.abs(trend) }}% vs last week
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [String, Number],
  unit: String,
  type: { type: String, default: 'primary' }, // primary, success, warn, error
  trend: Number
});
</script>

<style scoped>
.kpi-card {
  background: rgba(13, 17, 23, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  backdrop-filter: blur(10px);
  transition: transform 0.2s, border-color 0.2s;
}

.kpi-card:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 210, 255, 0.3);
  background: rgba(13, 17, 23, 0.8);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: rgba(255, 255, 255, 0.03);
  color: #666;
}

.card-icon.primary { background: rgba(0, 210, 255, 0.1); color: #00d2ff; }
.card-icon.success { background: rgba(0, 255, 136, 0.1); color: #00ff88; }
.card-icon.warn { background: rgba(255, 235, 59, 0.1); color: #ffeb3b; }
.card-icon.error { background: rgba(255, 82, 82, 0.1); color: #ff5252; }

.card-content { flex: 1; }

.kpi-label {
  font-size: 11px;
  color: #8b949e;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
  font-weight: 600;
}

.kpi-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
}

.kpi-unit {
  font-size: 12px;
  color: #666;
}

.kpi-trend {
  font-size: 10px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.kpi-trend.up { color: #00ff88; }
.kpi-trend.down { color: #ff5252; }
</style>
