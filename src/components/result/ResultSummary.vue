<template>
  <div class="result-summary text-white">
    <!-- Array View (Sweep/Multi-Job) -->
    <div v-if="isArray" class="table-container custom-scroll">
      <table class="summary-table">
        <thead>
          <tr>
            <th v-for="head in headers" :key="head">{{ formatLabel(head) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in metrics" :key="idx">
            <td v-for="head in headers" :key="head" :class="{ 'highlight-col': head === 'job_id' }">
              {{ formatValue(row[head]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Object View (Single Run) -->
    <div v-else-if="hasKeys" class="metrics-grid">
      <div v-for="(value, key) in metrics" :key="key" class="metric-card">
        <div class="metric-label">{{ formatLabel(key) }}</div>
        <div class="metric-value">{{ formatValue(value) }}</div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="no-metrics">
      <div class="empty-icon">📊</div>
      <div>NO SUMMARY DATA AVAILABLE</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  metrics: { type: [Array, Object], default: () => [] }
});

const isArray = computed(() => Array.isArray(props.metrics));
const hasKeys = computed(() => props.metrics && Object.keys(props.metrics).length > 0);

const headers = computed(() => {
  if (!isArray.value || props.metrics.length === 0) return [];
  // Get all unique keys from all objects to be safe, or just first object
  return Object.keys(props.metrics[0]);
});

const formatLabel = (key) => {
  if (key === null || key === undefined) return '';
  return String(key).replace(/_/g, ' ').toUpperCase();
};

const formatValue = (val) => {
  if (typeof val === 'number') {
    // Check if it's an integer (like job_id) or float
    if (Number.isInteger(val)) return val;
    return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return val;
};
</script>

<style scoped>
.result-summary {
  padding: 20px;
  height: 100%;
  overflow: hidden; /* Handle scroll internally */
  display: flex; flex-direction: column;
}

.custom-scroll { overflow: auto; }
.custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-corner { background: transparent; }

/* Table Styles */
.table-container {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.summary-table th {
  background: #161b22;
  color: #8b949e;
  font-weight: 600;
  text-align: left;
  padding: 12px 15px;
  position: sticky; top: 0;
  border-bottom: 1px solid #30363d;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.summary-table td {
  padding: 10px 15px;
  border-bottom: 1px solid #21262d;
  color: #c9d1d9;
  font-family: 'Consolas', monospace;
}

.summary-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.highlight-col {
  color: #00d2ff !important;
  font-weight: bold;
}

/* Grid Styles (Legacy) */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  overflow-y: auto;
}

.metric-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 4px;
  transition: all 0.2s;
}

.metric-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(0, 210, 255, 0.3);
}

.metric-label {
  font-size: 10px;
  color: #888;
  font-weight: 700;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 18px;
  color: #00d2ff;
  font-family: 'Consolas', monospace;
  font-weight: 600;
}

/* Empty State */
.no-metrics {
  flex: 1;
  display: flex; flex-direction: column;
  allign-items: center; justify-content: center;
  color: #444;
  font-size: 12px;
  letter-spacing: 1px;
  text-align: center;
}
.empty-icon { font-size: 24px; margin-bottom: 10px; opacity: 0.5; }
</style>
