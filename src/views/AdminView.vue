<template>
  <div class="admin-layout fade-in">
    <!-- 1. Vertical Sidebar -->
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <div class="logo-circle">⚡</div>
        <span class="brand-name">SYSTEM ADMIN</span>
      </div>
      
      <nav class="sidebar-nav">
        <div 
          v-for="tab in tabs" 
          :key="tab.id"
          class="nav-item" 
          :class="{ active: currentTab === tab.id }"
          @click="currentTab = tab.id"
        >
          <span class="icon">{{ tab.icon }}</span>
          <span class="label">{{ tab.label }}</span>
          <span class="indicator" v-if="currentTab === tab.id"></span>
        </div>
      </nav>

      <div class="sidebar-footer">
        <button class="exit-btn" @click="exitAdmin">
          <span class="icon">⬅</span> Return to App
        </button>
      </div>
    </aside>

    <!-- 2. Main Content Area -->
    <main class="admin-main">
      
      <!-- Top Header / Breadcrumb -->
      <header class="content-header">
        <div class="header-left">
          <h2 class="page-title">{{ currentTabLabel }}</h2>
          <span class="last-updated">Last updated: {{ new Date().toLocaleTimeString() }}</span>
        </div>
        <div class="header-right">
           <!-- Dynamic Actions based on Tab -->
           <button v-if="currentTab === 'logs'" class="bi-btn primary" @click="fetchLogs">
             <span class="icon">⟳</span> Refresh
           </button>
           <button v-if="currentTab === 'assets'" class="bi-btn primary" @click="triggerUpload">
             <span class="icon">☁</span> Upload Asset
           </button>
        </div>
      </header>

      <!-- Scrollable Workspace -->
      <div class="content-workspace custom-scroll">
        
        <!-- DASHBOARD VIEW -->
        <div v-if="currentTab === 'dashboard'" class="dashboard-grid">
             <!-- KPI Cards (Top Row) -->
             <div class="dash-row">
                 <div class="kpi-card">
                   <div class="kpi-header">
                     <span class="kpi-title">Total Users</span>
                     <span class="kpi-icon blue">👥</span>
                   </div>
                   <div class="kpi-value">{{ systemStats?.stats?.users?.total || 0 }}</div>
                   <div class="kpi-sub">Active: {{ systemStats?.stats?.users?.active || 0 }}</div>
                 </div>

                 <div class="kpi-card">
                   <div class="kpi-header">
                     <span class="kpi-title">Total Projects</span>
                     <span class="kpi-icon orange">📂</span>
                   </div>
                   <div class="kpi-value">{{ systemStats?.stats?.projects?.total || 0 }}</div>
                   <div class="kpi-sub">Public: {{ systemStats?.stats?.projects?.public || 0 }}</div>
                 </div>

                 <div class="kpi-card">
                   <div class="kpi-header">
                     <span class="kpi-title">GoView Screens</span>
                     <span class="kpi-icon purple">📈</span>
                   </div>
                   <div class="kpi-value">{{ systemStats?.stats?.goview?.total || 0 }}</div>
                   <div class="kpi-sub">Published: {{ systemStats?.stats?.goview?.published || 0 }}</div>
                 </div>

                 <div class="kpi-card">
                   <div class="kpi-header">
                     <span class="kpi-title">Active Processes</span>
                     <span class="kpi-icon green">⚙</span>
                   </div>
                   <div class="kpi-value">{{ systemStats?.processes || 0 }}</div>
                   <div class="kpi-sub">System Threads</div>
                 </div>
             </div>

             <!-- Charts Area (2x2 Grid) -->
             <div class="chart-container full-width">
                <div class="chart-card">
                    <div class="chart-header">User & Role Distribution</div>
                    <div ref="userChartRef" class="chart-body"></div>
                </div>
                <div class="chart-card">
                    <div class="chart-header">Project Overview</div>
                    <div ref="projectChartRef" class="chart-body"></div>
                </div>
                <div class="chart-card">
                    <div class="chart-header">GoView Deployment</div>
                    <div ref="goviewChartRef" class="chart-body"></div>
                </div>
                <div class="chart-card">
                    <div class="chart-header">System Resource Monitor</div>
                    <div ref="resourceChartRef" class="chart-body"></div>
                </div>
             </div>
        </div>

        <!-- USERS TABLE -->
        <div v-if="currentTab === 'users'" class="table-container">
           <table class="bi-table">
             <thead>
               <tr>
                 <th>User Identity</th>
                 <th>Role Access</th>
                 <th>Status</th>
                 <th class="text-right">Actions</th>
               </tr>
             </thead>
             <tbody>
               <tr v-for="u in usersList" :key="u.id">
                 <td>
                   <div class="user-cell">
                     <div class="avatar-circle">{{ u.username.slice(0,2).toUpperCase() }}</div>
                     <div class="user-info">
                       <span class="u-name">{{ u.username }}</span>
                       <span class="u-id">{{ u.id }}</span>
                     </div>
                   </div>
                 </td>
                 <td>
                   <span v-if="u.is_superuser" class="badge purple">Administrator</span>
                   <span v-else class="badge gray">Operator</span>
                 </td>
                 <td>
                   <span v-if="u.is_active" class="status-dot online">Active</span>
                   <span v-else class="status-dot offline">Inactive</span>
                 </td>
                 <td class="text-right">
                    <button class="icon-action danger" v-if="!u.is_superuser" @click="deleteUser(u)" title="Delete User">
                      🗑
                    </button>
                 </td>
               </tr>
             </tbody>
           </table>
        </div>

        <!-- PROJECTS TABLE -->
        <div v-if="currentTab === 'projects'" class="table-container">
           <table class="bi-table">
             <thead>
               <tr>
                 <th>Project Name</th>
                 <th>Owner ID</th>
                 <th>Visibility</th>
                 <th class="text-right">Manage</th>
               </tr>
             </thead>
             <tbody>
               <tr v-for="p in projectsList" :key="p.id">
                 <td>
                   <div class="project-cell">
                     <span class="p-icon">📂</span>
                     <span class="p-name">{{ p.name }}</span>
                   </div>
                 </td>
                 <td class="mono-text">{{ p.user_id ? p.user_id.slice(0,8) + '...' : 'System' }}</td>
                 <td>
                   <span v-if="p.is_public" class="badge blue">Public</span>
                   <span v-else class="badge dark">Private</span>
                 </td>
                 <td class="text-right actions-group">
                    <button v-if="!p.is_public" class="btn-xs outline" @click="togglePublish(p, true)">Archive</button>
                    <button v-else class="btn-xs outline warning" @click="togglePublish(p, false)">Restore</button>
                    <button class="icon-action danger" @click="deleteProject(p)">🗑</button>
                 </td>
               </tr>
             </tbody>
           </table>
        </div>

        <!-- GOVIEW TABLE -->
        <div v-if="currentTab === 'goview'" class="table-container">
           <table class="bi-table">
             <thead>
               <tr>
                 <th>GoView Project</th>
                 <th>Creator ID</th>
                 <th>State</th>
                 <th>Last Updated</th>
                 <th class="text-right">Actions</th>
               </tr>
             </thead>
             <tbody>
               <tr v-for="g in goviewList" :key="g.id">
                 <td>
                   <div class="project-cell">
                     <div class="preview-thumb" v-if="g.index_image">
                        <img :src="g.index_image" alt="preview" />
                     </div>
                     <span class="p-icon" v-else>📊</span>
                     <div class="user-info">
                        <span class="p-name">{{ g.project_name }}</span>
                        <span class="u-id">{{ g.id }}</span>
                     </div>
                   </div>
                 </td>
                 <td class="mono-text">{{ g.create_user_id ? g.create_user_id.slice(0,8) + '...' : 'Unknown' }}</td>
                 <td>
                   <span v-if="g.state === 1" class="badge blue">Published</span>
                   <span v-else-if="g.state === -1" class="badge gray">Draft</span>
                   <span v-else class="badge dark">Unknown</span>
                   <span v-if="g.is_delete" class="badge danger" style="margin-left:5px">Deleted</span>
                 </td>
                 <td class="mono-text">{{ new Date(g.update_time).toLocaleString() }}</td>
                 <td class="text-right actions-group">
                     <button v-if="!g.is_delete" class="btn-xs outline" @click="copyLink(g)">Copy URL</button>
                    <a v-if="!g.is_delete" :href="`/goview/#/chart/preview/${g.id}`" target="_blank" class="btn-xs outline">Open</a>
                    <button v-if="!g.is_delete" class="icon-action danger" @click="deleteGoviewProject(g)" title="Delete Project">🗑</button>
                 </td>
               </tr>
             </tbody>
           </table>
        </div>

        <!-- ASSETS VIEW -->
        <div v-if="currentTab === 'assets'" class="assets-view">
           <!-- Hidden File Inputs -->
           <input type="file" ref="assetInput" @change="uploadAssetModel" accept=".glb" hidden />
           <input type="file" ref="templateInput" @change="updateDemoTemplate" accept=".mo" hidden />

           <div class="section-title">3D Model Library</div>
           <div class="assets-grid">
             <div class="asset-card add-new" @click="triggerUpload">
                <div class="plus-icon">+</div>
                <span>Upload New Model</span>
             </div>
             
             <div class="asset-card" v-for="m in assetModels" :key="m.name">
               <div class="asset-preview">
                 <span class="preview-icon">📦</span>
               </div>
               <div class="asset-info">
                 <div class="asset-name" :title="m.name">{{ m.name }}</div>
                 <div class="asset-meta">{{ (m.size / 1024 / 1024).toFixed(2) }} MB</div>
               </div>
               <button class="asset-delete" @click="deleteAsset(m)">×</button>
             </div>
           </div>

           <div class="divider"></div>

           <div class="section-title warning">System Templates</div>
           <div class="system-template-card">
              <div class="tpl-icon">📄</div>
              <div class="tpl-info">
                <h4>Default Demo Model (example_model.mo)</h4>
                <p>This file is used when users create a new "Demo Project".</p>
              </div>
              <button class="bi-btn warning" @click="triggerTemplateUpdate">Replace Template</button>
           </div>
        </div>

        <!-- LOGS VIEW -->
        <div v-if="currentTab === 'logs'" class="logs-view">
           <div class="console-window">
              <div class="console-header">
                 <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
                 <span class="console-title">backend.log (Tail 500)</span>
                 <button class="console-action" @click="downloadLogs">⬇ Download</button>
              </div>
              <div class="console-body custom-scroll" ref="logContainer">
                 <pre>{{ systemLogs }}</pre>
              </div>
           </div>
        </div>

      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { useAuth } from '../composables/useAuth';
import { $notify } from '../utils/notification';
import apiClient from '../api/client';

const router = useRouter();
const { currentUser } = useAuth();
const currentTab = ref('dashboard');

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'projects', label: 'Projects', icon: '📂' },
  { id: 'goview', label: 'GoView', icon: '📈' },
  { id: 'assets', label: 'Assets', icon: '🧩' },
  { id: 'logs', label: 'System Logs', icon: '📝' },
];

const currentTabLabel = computed(() => {
    const t = tabs.find(t => t.id === currentTab.value);
    return t ? t.label : 'Overview';
});

// State
const systemStats = ref({});
const usersList = ref([]);
const projectsList = ref([]);
const goviewList = ref([]);
const assetModels = ref([]);
const systemLogs = ref('');
const logContainer = ref(null);
const assetInput = ref(null);
const templateInput = ref(null);

// Chart Refs
const userChartRef = ref(null);
const projectChartRef = ref(null);
const goviewChartRef = ref(null);
const resourceChartRef = ref(null);
let charts = {};

let statsInterval = null;
let logsInterval = null;

// Actions
const exitAdmin = () => router.push({ name: 'home' });

// Init Charts
const initCharts = () => {
    if(!userChartRef.value) return;

    // 1. User Chart
    charts.user = echarts.init(userChartRef.value);
    // 2. Project Chart
    charts.project = echarts.init(projectChartRef.value);
    // 3. GoView Chart
    charts.goview = echarts.init(goviewChartRef.value);
    // 4. Resource Chart
    charts.resource = echarts.init(resourceChartRef.value);

    updateCharts();
    window.addEventListener('resize', resizeCharts);
};

const resizeCharts = () => {
    Object.values(charts).forEach(c => c.resize());
};

const updateCharts = () => {
    if(!systemStats.value.stats) return;
    const s = systemStats.value.stats;

    // User Pie
    charts.user.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: '5%', left: 'center', textStyle: { color: '#ccc' } },
        series: [{
            name: 'Users',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 10, borderColor: '#0d1117', borderWidth: 2 },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
            data: [
                { value: s.users.admin, name: 'Admin', itemStyle: { color: '#a855f7' } },
                { value: s.users.operator, name: 'Operator', itemStyle: { color: '#00d2ff' } },
                { value: s.users.total - s.users.active, name: 'Inactive', itemStyle: { color: '#30363d' } }
            ]
        }],
        backgroundColor: 'transparent'
    });

    // Project Bar
    charts.project.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [{ type: 'category', data: ['Public', 'Private'], axisLabel: { color: '#ccc' } }],
        yAxis: [{ type: 'value', axisLabel: { color: '#ccc' }, splitLine: { lineStyle: { color: '#30363d' } } }],
        series: [{
            name: 'Projects',
            type: 'bar',
            barWidth: '60%',
            data: [
                { value: s.projects.public, itemStyle: { color: '#00d2ff' } },
                { value: s.projects.private, itemStyle: { color: '#238636' } }
            ]
        }],
        backgroundColor: 'transparent'
    });

    // GoView Donut
    charts.goview.setOption({
         tooltip: { trigger: 'item' },
         legend: { bottom: '5%', left: 'center', textStyle: { color: '#ccc' } },
         series: [{
             name: 'GoView',
             type: 'pie',
             radius: ['50%', '70%'],
             avoidLabelOverlap: false,
             label: { show: false },
             data: [
                 { value: s.goview.published, name: 'Published', itemStyle: { color: '#00d2ff' } },
                 { value: s.goview.draft, name: 'Draft', itemStyle: { color: '#888' } }
             ]
         }],
         backgroundColor: 'transparent'
    });

    // Resource Line (Mock History for now, or just current gauge)
    const cpu = systemStats.value.cpu || 0;
    const mem = systemStats.value.memory?.percent || 0;
    const now = new Date().toLocaleTimeString();

    // Ideally we keep a history array, but for simplicity let's use a Gauge for now
    charts.resource.setOption({
        tooltip: { formatter: '{a} <br/>{b} : {c}%' },
        series: [
            {
                name: 'CPU',
                type: 'gauge',
                center: ['25%', '50%'],
                radius: '90%',
                progress: { show: true },
                detail: { valueAnimation: true, formatter: '{value}', fontSize: 14, color: '#fff' },
                data: [{ value: cpu, name: 'CPU', itemStyle: { color: '#ff9900' } }],
                axisLabel: { show: false }, axisTick: { show: false }, splitLine: { show: false }
            },
            {
                name: 'Memory',
                type: 'gauge',
                center: ['75%', '50%'],
                radius: '90%',
                progress: { show: true },
                detail: { valueAnimation: true, formatter: '{value}', fontSize: 14, color: '#fff' },
                data: [{ value: mem, name: 'RAM', itemStyle: { color: '#00d2ff' } }],
                axisLabel: { show: false }, axisTick: { show: false }, splitLine: { show: false }
            }
        ],
        backgroundColor: 'transparent'
    });
};

// Fetch Data
const fetchStats = async () => { 
    try { 
        systemStats.value = await apiClient.get('/admin/system/stats'); 
        if(currentTab.value === 'dashboard' && charts.user) updateCharts();
    } catch(e) {} 
};
const fetchUsers = async () => { try { usersList.value = await apiClient.get('/admin/users'); } catch(e) {} };
const fetchProjects = async () => { try { projectsList.value = await apiClient.get('/admin/projects'); } catch(e) {} };
const fetchGoviewProjects = async () => { try { goviewList.value = await apiClient.get('/admin/goview/projects'); } catch(e) {} };
const fetchAssets = async () => { try { assetModels.value = await apiClient.get('/admin/assets/models'); } catch(e) {} };
const fetchLogs = async () => {
    try {
        const res = await apiClient.get('/admin/logs?lines=500');
        systemLogs.value = res.logs;
        if (logContainer.value) { setTimeout(() => { logContainer.value.scrollTop = logContainer.value.scrollHeight; }, 50); }
    } catch(e) {}
};

const downloadLogs = async () => {
    try {
        const response = await apiClient.get('/admin/logs/download', { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response]));
        const link = document.createElement('a');
        link.href = url; link.setAttribute('download', `backend_log.txt`);
        document.body.appendChild(link); link.click(); link.remove();
    } catch (e) { $notify({ title: 'Error', message: 'Download failed.', type: 'error' }); }
};

// Lifecycle
onMounted(() => {
    fetchStats().then(() => {
        nextTick(() => { if(currentTab.value === 'dashboard') initCharts(); });
    }); 
    fetchUsers(); fetchProjects(); fetchGoviewProjects(); fetchAssets(); fetchLogs();
    
    statsInterval = setInterval(fetchStats, 2000);
    logsInterval = setInterval(() => { if (currentTab.value === 'logs') fetchLogs(); }, 5000);
});
onUnmounted(() => { 
    if (statsInterval) clearInterval(statsInterval); 
    if (logsInterval) clearInterval(logsInterval);
    window.removeEventListener('resize', resizeCharts);
    Object.values(charts).forEach(c => c.dispose());
});

watch(currentTab, (newVal) => {
    if(newVal === 'dashboard') {
        nextTick(() => {
             initCharts();
             updateCharts();
        });
    }
});

// Operations
const deleteUser = async (u) => {
    if(!confirm(`Delete User ${u.username}?`)) return;
    try { await apiClient.delete(`/admin/users/${u.id}`); fetchUsers(); $notify({ title: 'Deleted', type: 'success' }); } catch { $notify({ title: 'Failed', type: 'error' }); }
};
const deleteProject = async (p) => {
    if(!confirm(`Delete Project ${p.name}?`)) return;
    try { await apiClient.delete(`/admin/projects/${p.id}`); fetchProjects(); } catch { $notify({ title: 'Failed', type: 'error' }); }
};
const togglePublish = async (p, isPublic) => {
    try {
        const endpoint = isPublic ? 'publish' : 'unpublish';
        await apiClient.patch(`/admin/projects/${p.id}/${endpoint}`);
        p.is_public = isPublic;
        $notify({ title: 'Updated', type: 'success' });
    } catch { $notify({ title: 'Failed', type: 'error' }); }
};
const deleteAsset = async (m) => {
    if(!confirm(`Delete Model ${m.name}?`)) return;
    try { await apiClient.delete(`/admin/assets/models/${m.name}`); fetchAssets(); } catch { $notify({ title: 'Failed', type: 'error' }); }
};

const deleteGoviewProject = async (g) => {
    if(!confirm(`Delete GoView Project ${g.project_name}?`)) return;
    try { await apiClient.delete(`/admin/goview/projects/${g.id}`); fetchGoviewProjects(); $notify({ title: 'Deleted', type: 'success' }); } catch { $notify({ title: 'Failed', type: 'error' }); }
};

const toggleGoviewPublish = async (g, state) => {
    try {
        await apiClient.patch(`/admin/goview/projects/${g.id}/publish`, { state });
        g.state = state;
        const status = state === 1 ? 'Published' : 'Unpublished';
        $notify({ title: status, message: state === 1 ? 'Project is now public.' : 'Project is now private.', type: 'success' });
    } catch { $notify({ title: 'Failed', type: 'error' }); }
};

const copyLink = (g) => {
    const url = `${window.location.origin}/goview/#/chart/preview/${g.id}`;
    navigator.clipboard.writeText(url).then(() => {
        $notify({ title: 'Copied', message: url, type: 'success' });
    });
};

// Upload Triggers
const triggerUpload = () => assetInput.value.click();
const triggerTemplateUpdate = () => templateInput.value.click();

const uploadAssetModel = async (e) => {
  const file = e.target.files[0]; if(!file) return;
  const formData = new FormData(); formData.append('file', file);
  try { await apiClient.post('/admin/assets/models', formData); fetchAssets(); $notify({ title: 'Uploaded', type: 'success' }); } 
  catch { $notify({ title: 'Failed', type: 'error' }); }
};
const updateDemoTemplate = async (e) => {
  const file = e.target.files[0]; if(!file) return;
  const formData = new FormData(); formData.append('file', file);
  try { await apiClient.post('/admin/assets/example_model', formData); $notify({ title: 'Template Updated', type: 'success' }); } 
  catch { $notify({ title: 'Failed', type: 'error' }); }
};
</script>

<style scoped>
/* --- Layout & Base --- */
.admin-layout {
  display: flex; width: 100%; height: 100%;
  background: #05070a; /* Original Dark Background */
  color: #ccc;
  font-family: 'Inter', 'Roboto Mono', sans-serif;
  overflow: hidden;
}

/* --- Sidebar --- */
.admin-sidebar {
  width: 240px;
  background: #0d1117; /* GitHub Dimmed */
  border-right: 1px solid #30363d;
  display: flex; flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  height: 60px; display: flex; align-items: center; padding: 0 20px;
  border-bottom: 1px solid #30363d; gap: 12px;
}
.logo-circle {
  width: 28px; height: 28px; background: rgba(0, 210, 255, 0.1); border: 1px solid #00d2ff; border-radius: 4px;
  display: flex; align-items: center; justify-content: center; font-size: 14px; color: #00d2ff;
  box-shadow: 0 0 10px rgba(0, 210, 255, 0.2);
}
.brand-name { font-weight: 800; font-size: 14px; letter-spacing: 1px; color: #fff; }

.sidebar-nav { flex: 1; padding: 20px 10px; display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; border-radius: 4px;
  cursor: pointer; color: #888; font-weight: 600; font-size: 12px;
  transition: all 0.2s; position: relative;
  border: 1px solid transparent;
}
.nav-item:hover { background: rgba(255,255,255,0.03); color: #ccc; }
.nav-item.active { 
  background: rgba(0, 210, 255, 0.1); 
  color: #00d2ff; 
  border-color: rgba(0, 210, 255, 0.2);
}
.nav-item .icon { font-size: 16px; width: 20px; text-align: center; }

.sidebar-footer { padding: 15px; border-top: 1px solid #30363d; }
.exit-btn {
  width: 100%; padding: 8px; background: transparent; border: 1px solid #30363d;
  color: #666; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.2s; font-weight: 600; font-size: 11px;
}
.exit-btn:hover { border-color: #666; color: #ccc; background: rgba(255,255,255,0.02); }

/* --- Main Content --- */
.admin-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.content-header {
  height: 60px; border-bottom: 1px solid #30363d;
  background: #05070a; display: flex; align-items: center; justify-content: space-between;
  padding: 0 30px; flex-shrink: 0;
}
.page-title { font-size: 16px; font-weight: 800; color: #fff; margin: 0; letter-spacing: 1px; text-transform: uppercase; }
.last-updated { font-size: 11px; color: #444; margin-left: 15px; font-family: monospace; }
.header-left { display: flex; align-items: baseline; }

.content-workspace { flex: 1; overflow-y: auto; padding: 30px; }

/* --- Buttons --- */
.bi-btn {
  padding: 6px 14px; border-radius: 4px; border: 1px solid transparent; font-weight: 700; font-size: 11px;
  display: flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; letter-spacing: 0.5px;
}
.bi-btn.primary { background: rgba(0, 210, 255, 0.1); border-color: #00d2ff; color: #00d2ff; }
.bi-btn.primary:hover { background: #00d2ff; color: #000; box-shadow: 0 0 10px rgba(0, 210, 255, 0.3); }
.bi-btn.warning { background: rgba(255, 234, 0, 0.1); border-color: #ffea00; color: #ffea00; }
.bi-btn.warning:hover { background: #ffea00; color: #000; }

/* --- Dashboard Grid (KPIs) --- */
.dashboard-grid { 
    display: flex; flex-direction: column; gap: 20px;
}
.full-width { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; height: 500px; }

.chart-card {
    background: #0d1117; border: 1px solid #30363d; border-radius: 4px;
    display: flex; flex-direction: column; overflow: hidden;
}
.chart-header {
    padding: 10px 15px; border-bottom: 1px solid #30363d;
    font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px;
}
.chart-body { flex: 1; min-height: 200px; }

.dash-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.kpi-card {
  background: #0d1117; border-radius: 4px; padding: 20px;
  border: 1px solid #30363d;
  transition: transform 0.2s;
  flex: 1;
}
.kpi-card:hover { border-color: #00d2ff; box-shadow: 0 0 15px rgba(0, 210, 255, 0.05); }
.kpi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.kpi-title { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 1px; }
.kpi-icon { width: 30px; height: 30px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid transparent; }
.kpi-icon.orange { background: rgba(255, 153, 0, 0.1); color: #ff9900; border-color: rgba(255, 153, 0, 0.2); }
.kpi-icon.blue { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border-color: rgba(0, 210, 255, 0.2); }
.kpi-icon.purple { background: rgba(168, 85, 247, 0.1); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.2); }
.kpi-icon.green { background: rgba(0, 255, 136, 0.1); color: #00ff88; border-color: rgba(0, 255, 136, 0.2); }

.kpi-value { font-size: 28px; font-weight: 700; color: #eee; line-height: 1; margin-bottom: 10px; font-family: 'Consolas', monospace; }
.kpi-value .unit { font-size: 14px; color: #666; font-weight: 600; margin-left: 2px; }
.text-danger { color: #ff5252; }

.progress-track { height: 4px; background: #21262d; border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 2px; }
.progress-fill.orange { background: #ff9900; box-shadow: 0 0 5px rgba(255,153,0,0.5); }
.progress-fill.blue { background: #00d2ff; box-shadow: 0 0 5px rgba(0,210,255,0.5); }
.progress-fill.green { background: #00ff88; box-shadow: 0 0 5px rgba(0,255,136,0.5); }
.kpi-sub { font-size: 11px; color: #555; }

/* --- BI Tables --- */
.table-container { background: #0d1117; border-radius: 4px; border: 1px solid #30363d; overflow: hidden; }
.bi-table { width: 100%; border-collapse: collapse; }
.bi-table th {
  text-align: left; padding: 12px 20px; background: #161b22;
  color: #666; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
  border-bottom: 1px solid #30363d;
}
.bi-table td { padding: 12px 20px; border-bottom: 1px solid #21262d; color: #ccc; font-size: 13px; vertical-align: middle; }
.bi-table tr:last-child td { border-bottom: none; }
.bi-table tr:hover td { background: rgba(255,255,255,0.02); }

.text-right { text-align: right; }

.user-cell { display: flex; align-items: center; gap: 10px; }
.avatar-circle { width: 32px; height: 32px; background: #21262d; border: 1px solid #30363d; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; color: #888; }
.user-info { display: flex; flex-direction: column; }
.u-name { font-weight: 700; color: #eee; font-size: 12px; }
.u-id { font-size: 10px; color: #555; font-family: monospace; }

.project-cell { display: flex; align-items: center; gap: 10px; }
.p-icon { font-size: 16px; color: #00d2ff; opacity: 0.8; }
.p-name { font-weight: 600; font-size: 12px; color: #eee; }
.mono-text { font-family: 'Consolas', monospace; color: #666; font-size: 11px; }

/* Badges & Dots */
.badge { padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase; border: 1px solid transparent; }
.badge.purple { background: rgba(168, 85, 247, 0.1); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.3); }
.badge.gray { background: rgba(148, 163, 184, 0.1); color: #cbd5e1; border-color: rgba(148, 163, 184, 0.3); }
.badge.blue { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border-color: rgba(0, 210, 255, 0.3); }
.badge.dark { background: #161b22; color: #666; border-color: #30363d; }
.badge.danger { background: rgba(255, 82, 82, 0.1); color: #ff5252; border-color: rgba(255, 82, 82, 0.3); }

.preview-thumb { width: 40px; height: 30px; border-radius: 2px; overflow: hidden; border: 1px solid #30363d; }
.preview-thumb img { width: 100%; height: 100%; object-fit: cover; }

.status-dot { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; }
.status-dot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
.status-dot.online { color: #00ff88; }
.status-dot.online::before { background: #00ff88; box-shadow: 0 0 5px rgba(0, 255, 136, 0.5); }
.status-dot.offline { color: #666; }
.status-dot.offline::before { background: #666; }

/* Actions */
.icon-action { background: transparent; border: none; color: #666; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 4px; transition: 0.2s; }
.icon-action:hover { color: #fff; }
.icon-action.danger:hover { color: #ff5252; text-shadow: 0 0 5px rgba(255, 82, 82, 0.5); }

.btn-xs { padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: 700; cursor: pointer; background: transparent; border: 1px solid #30363d; color: #888; transition: 0.2s; }
.btn-xs:hover { border-color: #666; color: #fff; }
.btn-xs.outline.warning:hover { border-color: #ffea00; color: #ffea00; }
.actions-group { display: flex; justify-content: flex-end; gap: 8px; align-items: center; }

/* --- Assets View --- */
.assets-view { display: flex; flex-direction: column; gap: 30px; }
.section-title { font-size: 12px; font-weight: 800; color: #888; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; text-transform: uppercase; letter-spacing: 1px; border-left: 2px solid #00d2ff; padding-left: 10px; }
.section-title.warning { border-color: #ffea00; }

.assets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
.asset-card { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; overflow: hidden; transition: 0.2s; position: relative; }
.asset-card:hover { border-color: #00d2ff; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 210, 255, 0.1); }

.asset-card.add-new { border-style: dashed; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; min-height: 140px; color: #666; font-weight: 600; font-size: 11px; }
.asset-card.add-new:hover { background: rgba(0, 210, 255, 0.05); color: #00d2ff; border-color: #00d2ff; }
.plus-icon { font-size: 24px; margin-bottom: 8px; }

.asset-preview { height: 90px; background: #161b22; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #30363d; }
.preview-icon { font-size: 32px; opacity: 0.5; }
.asset-info { padding: 10px; }
.asset-name { font-weight: 600; font-size: 12px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-meta { font-size: 10px; color: #555; margin-top: 4px; font-family: monospace; }
.asset-delete { position: absolute; top: 5px; right: 5px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.7); border: none; color: #fff; cursor: pointer; display: none; font-size: 12px; line-height: 1; }
.asset-card:hover .asset-delete { display: flex; align-items: center; justify-content: center; }
.asset-delete:hover { background: #ff5252; }

.system-template-card { background: rgba(255, 234, 0, 0.05); border: 1px solid rgba(255, 234, 0, 0.2); border-radius: 4px; padding: 20px; display: flex; align-items: center; gap: 20px; }
.tpl-icon { font-size: 24px; }
.tpl-info h4 { margin: 0 0 5px 0; color: #ffea00; font-size: 13px; font-weight: bold; }
.tpl-info p { margin: 0; color: #888; font-size: 11px; }

.divider { height: 1px; background: #30363d; width: 100%; }

/* --- Console --- */
.console-window { background: #05070a; border: 1px solid #30363d; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; height: 600px; }
.console-header { background: #0d1117; padding: 8px 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #30363d; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.red { background: #ff5252; } .dot.yellow { background: #ffea00; } .dot.green { background: #00ff88; }
.console-title { font-family: monospace; font-size: 11px; color: #666; margin-left: 10px; flex: 1; }
.console-action { background: #21262d; border: 1px solid #30363d; color: #ccc; padding: 3px 8px; border-radius: 3px; font-size: 10px; cursor: pointer; font-weight: 600; }
.console-action:hover { background: #30363d; color: #fff; }
.console-body { flex: 1; overflow-y: auto; padding: 15px; font-family: 'Consolas', monospace; font-size: 11px; color: #00ff88; line-height: 1.5; }

/* Utilities */
.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: #00d2ff; }
</style>
