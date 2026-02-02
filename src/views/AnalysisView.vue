<template>
  <div class="analysis-view">
    <!-- Sidebar / List -->
    <div class="analysis-sidebar">
      <div class="sidebar-header">
        <h2 class="title">ANALYSIS TASKS</h2>
        <button class="new-btn" @click="openWizard">+ NEW</button>
      </div>
      
      <div v-if="isLoading" class="loading-state">Loading...</div>
      
      <div class="task-list custom-scroll" v-else>
        <div 
          v-for="task in tasks" 
          :key="task.id" 
          class="task-item" 
          :class="{ active: selectedTask && selectedTask.id === task.id }"
          @click="selectTask(task)"
        >
          <div class="task-row top">
            <span class="task-name">{{ task.name }}</span>
            <span class="status-badge" :class="task.status.toLowerCase()">{{ task.status }}</span>
          </div>
          <div class="task-row bottom">
            <span class="task-date">{{ formatDate(task.created_at) }}</span>
            <button class="del-btn" @click.stop="deleteTask(task.id)">×</button>
          </div>
        </div>
        
        <div v-if="tasks && tasks.length === 0" class="empty-state">
           No analysis tasks found.
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="analysis-main">
        <!-- MODE 1: Wizard -->
        <div v-if="showWizard" class="wizard-container fade-in">
            <div class="wizard-header">
                <h3>CREATE ANALYSIS TASK</h3>
                <button class="close-btn" @click="closeWizard">Cancel</button>
            </div>
            
            <div class="wizard-body custom-scroll">
                <!-- Step 1: Basic & Type Selection -->
                <div class="form-group">
                   <label>Task Name</label>
                   <input v-model="wizardData.name" type="text" placeholder="Task Name" />
                </div>
                
                <div class="form-group">
                   <label>Analysis Template</label>
                   <div class="type-selector">
                      <div 
                        v-for="tpl in templates"
                        :key="tpl.id"
                        class="type-card" 
                        :class="{ active: selectedTemplateId === tpl.id }"
                        @click="selectTemplate(tpl)"
                      >
                         <div class="type-icon">{{ tpl.icon }}</div>
                         <div class="type-info">
                            <h4>{{ tpl.name }}</h4>
                            <p>{{ tpl.description }}</p>
                         </div>
                      </div>
                   </div>
                </div>
                
                <!-- Step 2: Dynamic Config Form -->
                <div v-if="selectedTemplate" class="config-section">
                    <h4 class="section-title">Configuration: {{ selectedTemplate.name }}</h4>
                    
                    <div v-for="(field, key) in selectedTemplate.schema" :key="key" class="form-group">
                        <label>{{ field.label }}</label>
                        
                        <!-- String/Number Input -->
                        <input 
                            v-if="['string', 'number', 'csv'].includes(field.type)"
                            v-model="wizardData[key]"
                            :type="field.type === 'number' ? 'number' : 'text'" 
                            :placeholder="field.placeholder" 
                        />
                        
                        <!-- Range Input -->
                         <div v-else-if="field.type === 'range'" class="range-input">
                            <input v-model="wizardData[key][0]" type="number" placeholder="Min" />
                            <span class="sep">-</span>
                            <input v-model="wizardData[key][1]" type="number" placeholder="Max" />
                        </div>
                        
                        <!-- Key-Value Lists (e.g. combinatorial params) -->
                        <div v-else-if="field.type === 'key_value_lists'" class="kv-list">
                            <div v-for="(item, idx) in wizardData[key]" :key="idx" class="kv-row">
                                <input v-model="item.key" :placeholder="field.placeholder_key" />
                                <input v-model="item.val" :placeholder="field.placeholder_val" />
                                <button class="del-btn-mini" @click="removeKvItem(key, idx)">×</button>
                            </div>
                            <button class="add-btn-mini" @click="addKvItem(key)">+ Add Parameter</button>
                        </div>
                        
                        <!-- Param Bounds (Sobol/Latin) -->
                        <div v-else-if="field.type === 'param_bounds'" class="param-bounds-table">
                            <div class="pb-header">
                                <span v-for="col in field.columns" :key="col">{{ col }}</span>
                                <span>Action</span>
                            </div>
                            <div v-for="(item, idx) in wizardData[key]" :key="idx" class="pb-row">
                                <input v-model="item.param" placeholder="Param Path" />
                                <input v-model="item.min" type="number" placeholder="Min" />
                                <input v-model="item.max" type="number" placeholder="Max" />
                                <select v-model="item.dist">
                                    <option value="unif">Uniform</option>
                                    <option value="norm">Normal</option>
                                </select>
                                <button class="del-btn-mini" @click="removeBoundItem(key, idx)">×</button>
                            </div>
                             <button class="add-btn-mini" @click="addBoundItem(key)">+ Add Parameter</button>
                        </div>
                        
                    </div>
                </div>
                 
                 <div class="wizard-actions">
                    <button class="submit-btn" @click="submitAnalysis" :disabled="isSubmitting || !selectedTemplate">
                        {{ isSubmitting ? 'SUBMITTING...' : 'START ANALYSIS' }}
                    </button>
                 </div>
            </div>
        </div>

        <!-- MODE 2: Result Viewer -->
        <div v-else-if="selectedTask" class="result-viewer fade-in">
             <div class="viewer-header">
                 <div class="vh-left">
                     <h2>{{ selectedTask.name }}</h2>
                     <span class="status-badge lg" :class="selectedTask.status.toLowerCase()">{{ selectedTask.status }}</span>
                 </div>
                 <div class="vh-right">
                     <button class="refresh-btn" @click="refreshTask">Refresh</button>
                 </div>
             </div>
             
             <!-- Tabs -->
             <div class="viewer-tabs">
                 <button :class="{ active: viewerTab === 'report' }" @click="viewerTab = 'report'">REPORT</button>
                 <button :class="{ active: viewerTab === 'raw' }" @click="viewerTab = 'raw'">RAW CONFIG</button>
             </div>
             
             <div class="viewer-body custom-scroll">
                 <div v-if="viewerTab === 'report'" class="report-container">
                     <div v-if="reportContent" class="markdown-body" v-html="renderedReport"></div>
                     <div v-else class="no-data">
                         <div v-if="selectedTask.status === 'COMPLETED'">No report found.</div>
                         <div v-else>Analysis is running... check back later.</div>
                     </div>
                 </div>
                 
                 <div v-if="viewerTab === 'raw'" class="raw-json">
                     <pre>{{ JSON.stringify(selectedTask.config_json, null, 2) }}</pre>
                 </div>
             </div>
        </div>
        
        <!-- MODE 3: Placeholder -->
        <div v-else class="empty-main">
            <div class="center-msg">Select a task or create a new one.</div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { analysisApi } from '../api/analysis';
import { useSimulation } from '../composables/useSimulation';
import { marked } from 'marked';

const { currentProjectId } = useSimulation();

const tasks = ref([]);
const templates = ref([]);
const isLoading = ref(false);
const selectedTask = ref(null);
const showWizard = ref(false);
const isSubmitting = ref(false);

const reportContent = ref('');
const viewerTab = ref('report');

// Wizard Data
const selectedTemplateId = ref(null);
const selectedTemplate = ref(null);
const wizardData = ref({ name: '' });

const renderedReport = computed(() => {
    if(!reportContent.value) return '';
    return marked(reportContent.value);
});

onMounted(() => {
    loadTasks();
    loadTemplates();
});

const loadTasks = async () => {
    if(!currentProjectId.value) return;
    isLoading.value = true;
    try {
        const result = await analysisApi.getTasks(currentProjectId.value);
        tasks.value = Array.isArray(result) ? result : [];
    } catch(e) { 
        console.error("Failed to load tasks:", e);
        tasks.value = []; // Fallback
    }
    isLoading.value = false;
};

const loadTemplates = async () => {
    try {
        templates.value = await analysisApi.getTemplates();
    } catch(e) { console.error("Failed to load templates", e); }
};

const formatDate = (ts) => {
    if(!ts) return '';
    return new Date(ts).toLocaleString();
};

const selectTask = async (task) => {
    selectedTask.value = task;
    showWizard.value = false;
    reportContent.value = ''; // clear previous
    
    // Fetch Report if completed
    if(task.status === 'COMPLETED') {
        try {
            reportContent.value = await analysisApi.getReport(task.id);
        } catch(e) { console.error(e); }
    }
};

const deleteTask = async (id) => {
    if(!confirm("Delete this analysis task?")) return;
    await analysisApi.deleteTask(id);
    if(selectedTask.value && selectedTask.value.id === id) selectedTask.value = null;
    loadTasks();
};

const refreshTask = async () => {
    if(!selectedTask.value) return;
    const fresh = await analysisApi.getTask(selectedTask.value.id);
    // Update list item
    const idx = tasks.value.findIndex(t => t.id === fresh.id);
    if(idx !== -1) tasks.value[idx] = fresh;
    
    // updateselected
    selectedTask.value = fresh;
    if(fresh.status === 'COMPLETED') {
        reportContent.value = await analysisApi.getReport(fresh.id);
    }
};

const openWizard = () => {
    selectedTask.value = null;
    showWizard.value = true;
    wizardData.value = { name: `Analysis_${new Date().getTime()}` };
    selectedTemplateId.value = null;
    selectedTemplate.value = null;
};

const closeWizard = () => {
    showWizard.value = false;
};

const selectTemplate = (tpl) => {
    selectedTemplateId.value = tpl.id;
    selectedTemplate.value = tpl;
    // Reset Data but keep name
    const currentName = wizardData.value.name;
    wizardData.value = { name: currentName };
    
    // Initialize Default Values from Schema
    for (const [key, field] of Object.entries(tpl.schema)) {
        if(field.default) wizardData.value[key] = JSON.parse(JSON.stringify(field.default));
        if(field.type === 'key_value_lists') wizardData.value[key] = [];
        if(field.type === 'param_bounds') wizardData.value[key] = [];
        if(field.type === 'range' && !field.default) wizardData.value[key] = [0, 0];
    }
};

const addKvItem = (key) => {
    if(!wizardData.value[key]) wizardData.value[key] = [];
    wizardData.value[key].push({ key: '', val: '' });
};

const removeKvItem = (key, idx) => {
    wizardData.value[key].splice(idx, 1);
};

const addBoundItem = (key) => {
    if(!wizardData.value[key]) wizardData.value[key] = [];
    wizardData.value[key].push({ param: '', min: 0, max: 1, dist: 'unif' });
};

const removeBoundItem = (key, idx) => {
    wizardData.value[key].splice(idx, 1);
};


const submitAnalysis = async () => {
    if(!currentProjectId.value || !selectedTemplateId.value) return;
    
    isSubmitting.value = true;
    
    try {
        // Send raw wizardData and let backend template logic handle conversion
        const config = { ...wizardData.value }; 
        await analysisApi.submitTask(currentProjectId.value, config.name, config, selectedTemplateId.value);
        showWizard.value = false;
        loadTasks();
    } catch(e) {
        alert("Submission Failed: " + e.message);
    }
    
    isSubmitting.value = false;
};


</script>

<style scoped>
.analysis-view {
    display: flex;
    width: 100%;
    height: 100vh;
    background: #05070a;
    color: #cbd5e1;
    font-family: 'Inter', sans-serif;
}

.analysis-sidebar {
    width: 280px;
    background: #0d1117;
    border-right: 1px solid #30363d;
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #30363d;
}

.title { font-size: 14px; font-weight: 800; color: #fff; margin: 0; }
.new-btn { 
    background: #00d2ff; color: #000; border: none; padding: 4px 10px; font-weight: 800; border-radius: 4px; cursor: pointer; font-size: 11px; transition: 0.2s;
}
.new-btn:hover { background: #fff; box-shadow: 0 0 10px #00d2ff; }

.task-list { flex: 1; overflow-y: auto; padding: 10px; }
.task-item {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: 0.2s;
}
.task-item:hover { border-color: #666; transform: translateX(2px); }
.task-item.active { border-color: #00d2ff; background: rgba(0, 210, 255, 0.05); }

.task-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.task-name { font-weight: 600; font-size: 13px; color: #fff; }
.task-date { font-size: 10px; color: #666; }
.del-btn { background: transparent; border: none; color: #666; font-size: 16px; cursor: pointer; }
.del-btn:hover { color: #ff5252; }

.status-badge { font-size: 9px; padding: 2px 6px; border-radius: 3px; font-weight: 800; text-transform: uppercase; }
.status-badge.pending { background: #333; color: #888; }
.status-badge.running { background: rgba(0, 210, 255, 0.1); color: #00d2ff; }
.status-badge.completed { background: rgba(0, 255, 136, 0.1); color: #00ff88; }
.status-badge.failed { background: rgba(255, 82, 82, 0.1); color: #ff5252; }

.analysis-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 30px;
    overflow: hidden;
}

/* Wizard Styles */
.wizard-container {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    max-width: 800px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    max-height: 90%;
}
.wizard-header {
    padding: 20px;
    border-bottom: 1px solid #30363d;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.wizard-header h3 { margin: 0; color: #fff; font-size: 16px; letter-spacing: 1px; }
.wizard-body { padding: 30px; overflow-y: auto; }

.form-group { margin-bottom: 25px; }
.form-group label { display: block; font-size: 12px; color: #888; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; }
.form-group input { 
    width: 100%; background: #161b22; border: 1px solid #30363d; padding: 12px; color: #fff; border-radius: 4px; font-family: 'Consolas', monospace; 
}
.form-group input:focus, .form-group select:focus { border-color: #00d2ff; outline: none; }
.form-group select { width: 100%; background: #161b22; border: 1px solid #30363d; padding: 12px; color: #fff; border-radius: 4px; }
.form-group small { color: #555; font-size: 11px; margin-top: 4px; display: block; }

.section-title { font-size: 12px; font-weight: 800; color: #888; text-transform: uppercase; margin-bottom: 15px; border-left: 2px solid #00d2ff; padding-left: 10px; }

.range-input { display: flex; align-items: center; gap: 10px; }
.range-input input { flex: 1; }
.sep { color: #888; }

.kv-row, .pb-row { display: flex; gap: 8px; margin-bottom: 8px; }
.kv-row input, .pb-row input, .pb-row select { flex: 1; min-width: 0; }
.del-btn-mini { background: rgba(255, 82, 82, 0.1); border: 1px solid rgba(255, 82, 82, 0.2); color: #ff5252; width: 30px; cursor: pointer; border-radius: 4px; }
.del-btn-mini:hover { background: #ff5252; color: #fff; }
.add-btn-mini { background: #161b22; border: 1px dashed #30363d; color: #888; width: 100%; padding: 8px; cursor: pointer; border-radius: 4px; font-size: 11px; }
.add-btn-mini:hover { border-color: #00d2ff; color: #00d2ff; }

.param-bounds-table { border: 1px solid #30363d; padding: 10px; border-radius: 4px; background: rgba(0,0,0,0.2); }
.pb-header { display: flex; gap: 8px; margin-bottom: 8px; color: #666; font-size: 10px; font-weight: 700; text-transform: uppercase; }
.pb-header span { flex: 1; }
.pb-header span:last-child { flex: 0 0 30px; }

.type-selector { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
.type-card {
    background: #161b22;
    border: 1px solid #30363d;
    padding: 20px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    gap: 15px;
    transition: 0.2s;
}
.type-card:hover { border-color: #888; }
.type-card.active { border-color: #00d2ff; background: rgba(0, 210, 255, 0.05); }
.type-icon { font-size: 24px; }
.type-info h4 { margin: 0 0 5px 0; color: #fff; font-size: 13px; font-weight: 700; }
.type-info p { margin: 0; color: #666; font-size: 11px; }

.submit-btn {
    width: 100%;
    padding: 15px;
    background: #00d2ff;
    color: #000;
    border: none;
    border-radius: 4px;
    font-weight: 800;
    cursor: pointer;
    font-size: 14px;
    letter-spacing: 1px;
}
.submit-btn:hover { background: #fff; box-shadow: 0 0 15px #00d2ff; }

/* Viewer Styles */
.result-viewer { display: flex; flex-direction: column; height: 100%; }
.viewer-header { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
.vh-left { display: flex; align-items: center; gap: 15px; }
.vh-left h2 { margin: 0; color: #fff; font-size: 20px; letter-spacing: 1px; }
.status-badge.lg { font-size: 11px; padding: 4px 10px; }
.refresh-btn { background: #161b22; border: 1px solid #30363d; color: #ccc; padding: 6px 12px; cursor: pointer; border-radius: 4px; }
.refresh-btn:hover { color: #fff; border-color: #666; }

.viewer-tabs { display: flex; border-bottom: 1px solid #30363d; margin-bottom: 20px; gap: 2px; }
.viewer-tabs button {
    background: transparent; border: none; color: #666; padding: 10px 20px; cursor: pointer; font-size: 12px; font-weight: 700; border-bottom: 2px solid transparent; text-transform: uppercase;
}
.viewer-tabs button.active { color: #00d2ff; border-bottom-color: #00d2ff; }
.viewer-tabs button:hover { color: #ccc; }

.viewer-body { flex: 1; overflow-y: auto; background: #0d1117; border-radius: 6px; border: 1px solid #30363d; padding: 30px; }
.markdown-body { color: #ccc; line-height: 1.6; max-width: 900px; margin: 0 auto; }
.raw-json { color: #00ff88; font-family: 'Consolas', monospace; font-size: 12px; white-space: pre-wrap; }

.empty-main { flex: 1; display: flex; align-items: center; justify-content: center; }
.center-msg { color: #333; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }

</style>
