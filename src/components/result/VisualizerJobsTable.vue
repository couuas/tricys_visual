<template>
  <div class="viz-panel">
    <div class="toolbar">
      <input
        type="text"
        v-model="jobFilter"
        placeholder="Filter jobs..."
        class="job-search"
        @input="handleFilter"
      />
      <label class="select-all">
        <input type="checkbox" :checked="selectAll" @change="toggleSelectAll" /> Select All (Page)
      </label>
      <div class="pager">
        <button @click="prevPage" :disabled="page <= 1">Prev</button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button @click="nextPage" :disabled="page >= pageCount">Next</button>
        <select v-model.number="pageSize" @change="resetPage">
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
    </div>

    <div class="table-wrap custom-scroll">
      <table v-if="columns.length > 0">
        <thead>
          <tr>
            <th class="col-select"></th>
            <th
              v-for="col in columns"
              :key="col.id"
              @click="toggleSort(col.id)"
              class="sortable"
            >
              {{ col.name }}
              <span v-if="sortBy === col.id">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td class="col-select">
              <input type="checkbox" :checked="selectedSet.has(row.id)" @change="toggleRow(row.id)" />
            </td>
            <td v-for="col in columns" :key="col.id">{{ row[col.id] }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">No jobs data found.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { visualizerApi } from '../../api/visualizer';

const props = defineProps({
  taskId: { type: [String, Number], required: true },
  columns: { type: Array, default: () => [] },
  selectedJobIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:selectedJobIds']);

const rows = ref([]);
const page = ref(1);
const pageSize = ref(50);
const total = ref(0);
const sortBy = ref('id');
const sortDir = ref('asc');
const jobFilter = ref('');

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const selectedSet = computed(() => new Set(props.selectedJobIds));
const selectAll = computed(() => {
  const ids = rows.value.map(r => r.id).filter(Boolean);
  return ids.length > 0 && ids.every(id => selectedSet.value.has(id));
});

const loadJobs = async () => {
  if (!props.taskId) return;
  try {
    const data = await visualizerApi.getJobs(props.taskId, {
      page: page.value,
      page_size: pageSize.value,
      sort_by: sortBy.value,
      sort_dir: sortDir.value,
      filter: jobFilter.value || undefined
    });
    rows.value = data.items || [];
    total.value = data.total || 0;
  } catch {
    rows.value = [];
    total.value = 0;
  }
};

const toggleRow = (id) => {
  const next = new Set(props.selectedJobIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit('update:selectedJobIds', Array.from(next));
};

const toggleSelectAll = () => {
  const pageIds = rows.value.map(r => r.id).filter(Boolean);
  const next = new Set(props.selectedJobIds);
  if (!selectAll.value) {
    pageIds.forEach(id => next.add(id));
  } else {
    pageIds.forEach(id => next.delete(id));
  }
  emit('update:selectedJobIds', Array.from(next));
};

const handleFilter = () => {
  page.value = 1;
  loadJobs();
};

const resetPage = () => {
  page.value = 1;
  loadJobs();
};

const prevPage = () => {
  if (page.value > 1) {
    page.value -= 1;
    loadJobs();
  }
};

const nextPage = () => {
  if (page.value < pageCount.value) {
    page.value += 1;
    loadJobs();
  }
};

const toggleSort = (colId) => {
  if (sortBy.value === colId) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = colId;
    sortDir.value = 'asc';
  }
  loadJobs();
};

watch(() => props.taskId, () => {
  page.value = 1;
  loadJobs();
});

onMounted(loadJobs);
</script>

<style scoped>
.viz-panel {
  background: #0b0e14;
  border: 1px solid #30363d;
  padding: 10px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.job-search {
  background: #05070a;
  border: 1px solid #30363d;
  color: #eee;
  padding: 6px;
  font-size: 11px;
  width: 240px;
}
.select-all {
  color: #888;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.pager {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #888;
  font-size: 11px;
}
.pager button {
  background: #161b22;
  border: 1px solid #30363d;
  color: #c9d1d9;
  padding: 4px 8px;
  cursor: pointer;
}
.pager button:disabled { opacity: 0.5; cursor: not-allowed; }
.pager select { background: #05070a; border: 1px solid #30363d; color: #c9d1d9; padding: 4px; }
.table-wrap { overflow: auto; }
.table-wrap table { width: 100%; border-collapse: collapse; font-size: 11px; }
.table-wrap th { background: #161b22; color: #8b949e; text-align: left; padding: 10px; position: sticky; top: 0; border-bottom: 1px solid #30363d; cursor: pointer; }
.table-wrap td { padding: 8px 10px; border-bottom: 1px solid #21262d; color: #c9d1d9; font-family: 'Consolas', monospace; }
.col-select { width: 30px; }
.sortable { user-select: none; }
.no-data { text-align: center; color: #666; padding: 20px; }
</style>
