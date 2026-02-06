<template>
  <div class="user-view">
    <!-- Global Header is handled by WorkbenchLayout -->
    <div class="content">
      
      <!-- UN-AUTHENTICATED: Login/Register Forms -->
      <div v-if="!isAuthenticated" class="auth-container fade-in">
        <div class="auth-header">
           <div class="auth-logo">⚛ TRICYS</div>
           <div class="auth-sub">TRitium Integrated CYcle Simulation</div>
        </div>

        <!-- Toggle Switch -->
        <div class="auth-toggle">
            <button class="toggle-btn" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">LOGIN</button>
            <button class="toggle-btn" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">REGISTER</button>
        </div>

        <!-- Login Form -->
        <div v-if="authMode === 'login'" class="auth-form">
           <p class="subtitle">Enter credentials to access workspace.</p>
           <div class="form-group">
               <label>USERNAME</label>
               <input type="text" v-model="loginForm.username" placeholder="Identity..." autofocus />
           </div>
           <div class="form-group">
               <label>PASSWORD</label>
               <input type="password" v-model="loginForm.password" @keyup.enter="handleLogin" placeholder="Secured..." />
           </div>
           <button class="action-btn" @click="handleLogin" :disabled="loading">
              {{ loading ? 'VERIFYING...' : 'ACCESS SYSTEM' }}
           </button>
           <p class="error-msg" v-if="errorMsg">{{ errorMsg }}</p>
        </div>

        <!-- Register Form -->
        <div v-if="authMode === 'register'" class="auth-form">
            <p class="subtitle">Create new operator identity.</p>
            <div class="form-group">
                <label>USERNAME *</label>
                <input type="text" v-model="regForm.username" placeholder="Unique identifier" />
            </div>
            <div class="form-group">
                <label>PASSWORD *</label>
                <input type="password" v-model="regForm.password" placeholder="Passphrase" />
            </div>
            <div class="form-group">
                <label>FULL NAME</label>
                <input type="text" v-model="regForm.full_name" placeholder="Display name" />
            </div>
            <div class="form-group">
                <label>EMAIL</label>
                <input type="text" v-model="regForm.email" placeholder="Contact (Optional)" />
            </div>
            <button class="action-btn" @click="handleRegister" :disabled="loading">
                {{ loading ? 'REGISTERING...' : 'CREATE IDENTITY' }}
            </button>
            <p class="error-msg" v-if="errorMsg">{{ errorMsg }}</p>
        </div>
      </div>

      <!-- AUTHENTICATED: Project Dashboard -->
      <div v-else class="project-dashboard fade-in">
         
          <div class="dashboard-main">
             <!-- 1. Create New Section -->
             <div class="section-create">
                <h3>INITIATE WORKSPACE</h3>
                <div class="create-grid">
                   
                   <!-- Upload Card -->
                   <div class="create-card upload" :class="{ processing: isProcessing.model }">
                      <div class="icon">📂</div>
                      <div class="c-title">UPLOAD SOURCE</div>
                      <div class="c-desc">Parse .mo files</div>
                      <input type="file" id="upload-model" accept=".mo,.txt" @change="handleModelUpload" :disabled="isAnyProcessing" hidden />
                      <label for="upload-model" class="btn-action">
                         {{ isProcessing.model ? 'PARSING...' : 'SELECT FILE' }}
                      </label>
                   </div>
 
                   <!-- Import Card -->
                   <div class="create-card import" :class="{ processing: isProcessing.project }">
                      <div class="icon">📦</div>
                      <div class="c-title">IMPORT ARCHIVE</div>
                      <div class="c-desc">Restore .zip project</div>
                      <input type="file" id="upload-project" accept=".zip" @change="handleProjectImport" :disabled="isAnyProcessing" hidden />
                      <label for="upload-project" class="btn-action">
                         {{ isProcessing.project ? 'RESTORING...' : 'SELECT ZIP' }}
                      </label>
                   </div>
 
                   <!-- Demo Card -->
                   <div class="create-card demo">
                      <div class="icon">⚛</div>
                      <div class="c-title">SYSTEM DEMO</div>
                      <div class="c-desc">Load reference cycle</div>
                      <button class="btn-action" @click="openDemo" :disabled="isAnyProcessing">
                         LAUNCH
                      </button>
                   </div>
 
                </div>
             </div>
 
             <!-- 2. Recent Projects List -->
             <div class="section-list">
                
                <!-- Resume Section (Moved inside right column) -->
                <div class="resume-group" v-if="lastProjectId">
                   <h3>CONTINUE WORK</h3>
                   <div class="resume-card" @click="resumeProject">
                      <div class="icon">▶</div>
                      <div class="r-info">
                         <div class="r-label">LAST ACTIVE</div>
                         <div class="r-name">{{ lastProjectId }}</div>
                      </div>
                      <div class="r-arrow">➝</div>
                   </div>
                   <div class="divider-h"></div>
                </div>
 
                 <!-- Toggle Tabs -->
                 <div class="list-tabs">
                     <button class="tab-btn" :class="{ active: viewMode === 'personal' }" @click="viewMode = 'personal'">MY PROJECTS</button>
                     <button class="tab-btn" :class="{ active: viewMode === 'public' }" @click="viewMode = 'public'">PUBLIC DISCOVERY</button>
                 </div>
 
                 <!-- Personal Projects -->
                 <div v-if="viewMode === 'personal'" class="project-list custom-scroll">
                    <div v-for="p in recentProjects" :key="p.id" class="project-row" @click="selectProject(p)">
                       <div class="row-icon">❖</div>
                       <div class="p-info">
                          <div class="p-name">{{ p.name || 'Untitled Project' }}</div>
                          <div class="p-meta">
                             <span class="meta-tag">ID: {{ (p.id || '').slice(0,8) }}</span>
                             <span class="meta-dot">&bull;</span>
                             <span>{{ formatDate(p.created_at) }}</span>
                          </div>
                       </div>
                       <div class="p-actions">
                          <button class="btn-export" @click.stop="handleExport(p)" title="Export Project Package">EXPORT</button>
                          <button class="btn-del" @click.stop="deleteProject(p.id)" title="Delete Project">✕</button>
                       </div>
                    </div>
                    <div v-if="recentProjects.length === 0" class="empty-list">No recent projects found.</div>
                 </div>
 
                 <!-- Public Projects -->
                 <div v-else class="project-list custom-scroll">
                    <div v-for="p in publicProjects" :key="p.id" class="project-row" @click="selectProject(p)">
                       <div class="row-icon">🌍</div>
                       <div class="p-info">
                          <div class="p-name">{{ p.name || 'Public Project' }}</div>
                          <div class="p-meta">
                             <span class="meta-tag">BY: {{ p.user_id ? p.user_id.slice(0,8) : 'System' }}</span>
                             <span class="meta-dot">&bull;</span>
                             <span>{{ formatDate(p.created_at) }}</span>
                          </div>
                       </div>
                       <div class="p-actions">
                          <button class="btn-fork" @click.stop="handleFork(p.id)" title="Clone to my projects">FORK</button>
                          <span class="readonly-tag">PREVIEW</span>
                       </div>
                    </div>
                    <div v-if="publicProjects.length === 0" class="empty-list">No public projects available.</div>
                 </div>
             </div>
          </div>
 
          <!-- Welcome Header (Moved to Bottom) -->
          <div class="welcome-header bottom-panel">
             <div class="w-text">
                <h2>WELCOME, {{ currentUser?.full_name || currentUser?.username }}</h2>
                <p>Select a project to continue or initiate a new simulation topology.</p>
             </div>
             <div class="w-actions">
                <button class="btn-logout-alt" @click="handleLogout">SIGN OUT Session</button>
             </div>
          </div>

      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { $notify } from '../utils/notification'; 
import { $confirm } from '../utils/dialog';
import { projectApi } from '../api/project';
import { useSimulation } from '../composables/useSimulation';

const router = useRouter();
const { isAuthenticated, currentUser, login, register, logout } = useAuth();
const { resetSession } = useSimulation();

// Auth Logic
const authMode = ref('login');
const loading = ref(false);
const errorMsg = ref('');
const loginForm = reactive({ username: '', password: '' });
const regForm = reactive({ username: '', password: '', full_name: '', email: '' });

const userInitials = computed(() => {
    if (!currentUser.value) return '?';
    const name = currentUser.value.full_name || currentUser.value.username;
    return name.slice(0, 2).toUpperCase();
});

const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) { errorMsg.value = "Credentials required"; return; }
    loading.value = true; errorMsg.value = '';
    
    // 1. Perform Login
    const res = await login(loginForm.username, loginForm.password);
    
    // 2. Clear loading immediately so UI can update
    loading.value = false;

    if (res.success) {
        $notify({ title: 'ACCESS GRANTED', message: `Welcome, ${res.user.username}.`, type: 'success' });
        // NOTE: loadProjects is triggered by the watcher on isAuthenticated
        // We don't need to call it here manually if the watcher works, 
        // but calling it doubles up safely or we can just let watcher handle it.
        // The transition happens because 'isAuthenticated' becomes true.
    } else {
        errorMsg.value = res.message;
        $notify({ title: 'ACCESS DENIED', message: res.message, type: 'error' });
    }
};

const handleRegister = async () => {
    if (!regForm.username) { errorMsg.value = "Username required"; return; }
    loading.value = true; errorMsg.value = '';
    const res = await register(regForm);
    loading.value = false;
    if (res.success) {
        $notify({ title: 'IDENTITY CREATED', message: `Registered as ${res.user.username}.`, type: 'success' });
        loadProjects();
    } else {
        errorMsg.value = res.message;
        $notify({ title: 'REGISTRATION FAILED', message: res.message, type: 'error' });
    }
};

const handleLogout = () => {
    logout();
    $notify({ title: 'LOGOUT', message: 'Session terminated.', type: 'info' });
};

// Project Logic
const recentProjects = ref([]);
const publicProjects = ref([]);
const viewMode = ref('personal'); // 'personal' or 'public'
const isProcessing = reactive({ model: false, project: false });
const isAnyProcessing = computed(() => isProcessing.model || isProcessing.project);

const lastProjectId = ref(localStorage.getItem('tricys_last_pid'));

const loadProjects = async () => {
    if (!isAuthenticated.value) return;
    try {
        const [personal, publicP] = await Promise.all([
            projectApi.listProjects(),
            projectApi.listPublicProjects()
        ]);
        recentProjects.value = Array.isArray(personal) ? personal : (personal.items || []);
        recentProjects.value.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        
        publicProjects.value = Array.isArray(publicP) ? publicP : (publicP.items || []);
        publicProjects.value.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (e) { console.error("Load projects failed", e); }
};

const resumeProject = () => {
    if (lastProjectId.value) {
        router.push({ name: 'config', query: { projectId: lastProjectId.value } });
    }
};

const selectProject = async (project) => {
    // API list returns 'id', create returns 'project_id'. normalize.
    const pid = project.id || project.project_id;
    if (!pid) return;
    
    localStorage.setItem('tricys_last_pid', pid);
    await resetSession();
    // Navigate to Config View
    router.push({ name: 'config', query: { projectId: pid } });
};

const handleFork = async (pid) => {
    isProcessing.project = true;
    try {
        const res = await projectApi.forkProject(pid);
        $notify({ title: 'PROJECT CLONED', message: 'The project has been added to your workspace.', type: 'success' });
        await loadProjects();
        viewMode.value = 'personal';
    } catch (e) {
        $notify({ title: 'FORK FAILED', message: e.response?.data?.detail || 'Could not clone project.', type: 'error' });
    } finally {
        isProcessing.project = false;
    }
};

const deleteProject = async (id) => {
    if (!confirm("Permanently delete this project?")) return;
    try {
        await projectApi.deleteProject(id);
        $notify({ title: 'DELETED', message: 'Project removed.', type: 'success' });
        loadProjects();
    } catch (e) {
        $notify({ title: 'ERROR', message: 'Delete failed.', type: 'error' });
    }
};

const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() + ' ' + new Date(iso).toLocaleTimeString() : '';

const handleExport = async (project) => {
    const pid = project.id || project.project_id;
    if (!pid || isAnyProcessing.value) return;
    
    isProcessing.project = true;
    try {
        const blob = await projectApi.exportProject(pid);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `project_${project.name || pid}.zip`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        $notify({ title: 'EXPORT SUCCESS', message: 'Project archive downloaded.', type: 'success' });
    } catch (e) {
        $notify({ title: 'EXPORT FAILED', message: 'Could not generate archive.', type: 'error' });
    } finally {
        isProcessing.project = false;
    }
};

// Actions from HomeView
const handleModelUpload = async (event) => {
  const file = event.target.files[0]; if (!file) return;
  isProcessing.model = true;
  try {
    const project = await projectApi.createProject(file);
    $notify({ title: 'SYSTEM READY', message: 'Topology parsed successfully.', type: 'success' });
    localStorage.setItem('tricys_last_pid', project.project_id);
    router.push({ name: 'config', query: { projectId: project.project_id } });
  } catch (error) {
    $notify({ title: 'PARSING ERROR', message: 'Failed to upload/parse model.', type: 'error' });
  } finally {
    isProcessing.model = false; event.target.value = '';
  }
};

const handleProjectImport = async (event) => {
  const file = event.target.files[0]; if (!file) return;
  isProcessing.project = true;

  try {
     const res = await projectApi.importProject(file);
     if (res && res.project_id) {
       $notify({ title: 'STATE RESTORED', message: 'Project environment loaded.', type: 'success' });
       loadProjects();
     } else { throw new Error("Import failed"); }
  } catch (e) {
    $notify({ title: 'IMPORT FAILED', message: 'Could not restore project.', type: 'error' });
  } finally {
    isProcessing.project = false; event.target.value = '';
  }
};

const openDemo = async () => {
   if (isAnyProcessing.value) return;
   isProcessing.project = true;
   try {
       const res = await projectApi.createDemo();
       if (res && res.project_id) {
           $notify({ title: 'DEMO READY', message: 'Demo environment initialized.', type: 'success' });
           localStorage.setItem('tricys_last_pid', res.project_id);
           router.push({ name: 'config', query: { projectId: res.project_id } });
       } else {
           throw new Error("Invalid response");
       }
   } catch (e) {
       $notify({ title: 'DEMO FAILED', message: 'Could not create demo project. Ensure backend supports demo mode.', type: 'error' });
   } finally {
       isProcessing.project = false;
   }
};

onMounted(() => {
    if (isAuthenticated.value) loadProjects();
});

watch(isAuthenticated, (newVal) => {
    if (newVal) loadProjects();
});
</script>

<style scoped>
.user-view { width: 100%; height: 100%; background: #05070a; color: #fff; display: flex; flex-direction: column; font-family: 'Inter', sans-serif; overflow: hidden; }
.content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: radial-gradient(circle at center, #0d1117 0%, #05070a 70%); }

/* --- Auth Styles --- */
.auth-container { width: 380px; margin: auto; background: rgba(13, 17, 23, 0.9); border: 1px solid #30363d; border-radius: 8px; backdrop-filter: blur(10px); padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.auth-header { text-align: center; margin-bottom: 25px; }
.auth-logo { font-size: 24px; font-weight: bold; color: #00ffff; letter-spacing: 2px; }
.auth-sub { font-size: 11px; color: #666; margin-top: 5px; }

.auth-toggle { display: flex; border-bottom: 1px solid #30363d; margin-bottom: 20px; }
.toggle-btn { flex: 1; padding: 10px; background: transparent; border: none; color: #666; font-weight: bold; cursor: pointer; font-size: 11px; transition: 0.2s; }
.toggle-btn.active { color: #00d2ff; border-bottom: 2px solid #00d2ff; background: rgba(0, 210, 255, 0.05); }

.auth-form { display: flex; flex-direction: column; gap: 15px; }
.subtitle { margin: 0; font-size: 12px; color: #888; text-align: center; margin-bottom: 10px; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-size: 10px; font-weight: bold; color: #555; letter-spacing: 1px; }
.form-group input { background: #05070a; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 4px; font-family: monospace; transition: 0.2s; }
.form-group input:focus { border-color: #00d2ff; outline: none; }
.action-btn { margin-top: 10px; padding: 12px; background: #00d2ff; border: none; border-radius: 4px; color: #000; font-weight: bold; cursor: pointer; transition: 0.2s; }
.action-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 15px rgba(0, 210, 255, 0.3); background: #fff; }
.error-msg { font-size: 11px; color: #ff5252; text-align: center; margin: 0; }

/* --- Dashboard Styles --- */
.project-dashboard { width: 100%; height: 100%; background: #0d1117; display: flex; flex-direction: column; overflow: hidden; }
.welcome-header { padding: 30px 40px; border-bottom: 1px solid #1c2128; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(to right, #0d1117, #0b0e14); }
.w-text h2 { margin: 0; font-size: 20px; color: #fff; letter-spacing: 1px; }
.w-text p { margin: 5px 0 0 0; font-size: 13px; color: #666; }
.btn-logout-alt { background: transparent; border: 1px solid #30363d; color: #888; padding: 10px 20px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-logout-alt:hover { border-color: #ff5252; color: #ff5252; background: rgba(255, 82, 82, 0.05); }

.project-dashboard { display: flex; flex-direction: column; height: 100%; }
.welcome-header { height: 120px; border-top: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center; padding: 0 30px; background: #0b0e14; flex-shrink: 0; }
.welcome-header.bottom-panel { order: 2; }
.dashboard-main { flex: 1; display: flex; overflow: hidden; order: 1; }

/* Create Section */
.section-create { flex: 1; padding: 30px; border-right: 1px solid #30363d; background: linear-gradient(135deg, rgba(0,0,0,0.2), transparent); }
.section-create h3, .section-list h3 { font-size: 12px; color: #666; font-weight: bold; letter-spacing: 1px; margin-bottom: 20px; }

.create-grid { display: grid; gap: 20px; }
.create-card { background: rgba(5, 7, 10, 0.5); border: 1px solid #30363d; padding: 20px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; text-align: center; transition: 0.2s; position: relative; }
.create-card:hover { border-color: #00d2ff; background: rgba(0, 210, 255, 0.02); transform: translateY(-2px); }
.create-card .icon { font-size: 24px; margin-bottom: 10px; }
.c-title { font-weight: bold; color: #fff; font-size: 14px; margin-bottom: 5px; }
.c-desc { font-size: 11px; color: #888; margin-bottom: 15px; }
.btn-action { width: 100%; padding: 10px; background: transparent; border: 1px solid #00d2ff; color: #00d2ff; font-weight: bold; font-size: 11px; cursor: pointer; text-transform: uppercase; transition: 0.2s; display: block; box-sizing: border-box; }
.btn-action:hover, .create-card:hover .btn-action { background: #00d2ff; color: #000; }

.create-card.demo { border-color: #30363d; }
.create-card.demo:hover { border-color: #ff00ff; }
.create-card.demo .btn-action { border-color: #ff00ff; color: #ff00ff; }
.create-card.demo .btn-action:hover { background: #ff00ff; color: #fff; }


/* List Section */
.section-list { flex: 1; padding: 30px; background: #0b0e14; display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid #1c2128; }
.project-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 0; padding-right: 5px; }
.project-row { 
   padding: 12px 15px; 
   background: #11141a; 
   border: 1px solid #21262d; 
   border-radius: 6px; 
   cursor: pointer; 
   display: flex; 
   justify-content: space-between; 
   align-items: center; 
   transition: all 0.2s ease; 
   gap: 15px;
}
.project-row:hover { 
   border-color: #00d2ff; 
   background: rgba(0, 210, 255, 0.05); 
   transform: translateX(3px); 
   box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.row-icon { color: #30363d; font-size: 16px; transition: 0.2s; }
.project-row:hover .row-icon { color: #00d2ff; }

.p-info { flex: 1; min-width: 0; }
.p-name { font-weight: bold; color: #eee; font-size: 13px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Inter', sans-serif; letter-spacing: 0.5px; }
.project-row:hover .p-name { color: #fff; text-shadow: 0 0 10px rgba(0,210,255,0.5); }

.p-meta { font-size: 10px; color: #666; font-family: monospace; display: flex; align-items: center; gap: 6px; }
.meta-tag { background: #1c2128; padding: 2px 5px; border-radius: 3px; color: #8b949e; }
.meta-dot { color: #30363d; }

.p-actions { display: flex; align-items: center; gap: 8px; }
.btn-export { background: rgba(0, 255, 136, 0.1); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); padding: 4px 8px; font-size: 9px; cursor: pointer; border-radius: 4px; transition: 0.2s; font-weight: bold; }
.btn-export:hover { background: #00ff88; color: #000; border-color: #00ff88; box-shadow: 0 0 10px rgba(0, 255, 136, 0.4); }
.btn-del { width: 24px; height: 24px; border: 1px solid transparent; background: transparent; color: #484f58; cursor: pointer; font-size: 14px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.btn-del:hover { background: rgba(255, 82, 82, 0.1); border-color: rgba(255, 82, 82, 0.3); color: #ff5252; }
.empty-list { text-align: center; color: #444; font-size: 12px; padding: 30px; border: 1px dashed #30363d; border-radius: 6px; background: rgba(255,255,255,0.01); }

/* Resume Group */
.resume-group { margin-bottom: 25px; flex-shrink: 0; }
.resume-card { background: linear-gradient(90deg, rgba(0, 210, 255, 0.1), rgba(0,0,0,0)); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 12px 15px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
.resume-card:hover { border-color: #00d2ff; background: linear-gradient(90deg, rgba(0, 210, 255, 0.2), rgba(0,0,0,0)); transform: translateX(2px); }
.resume-card .icon { color: #00d2ff; font-size: 14px; }
.r-info { flex: 1; min-width: 0; }
.r-label { font-size: 9px; color: #00d2ff; font-weight: bold; letter-spacing: 1px; margin-bottom: 2px; }
.r-name { font-size: 12px; color: #fff; font-weight: bold; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r-arrow { color: #00d2ff; font-weight: bold; font-size: 14px; }
.divider-h { height: 1px; background: #30363d; margin-top: 20px; }

/* Animations */
.fade-in { animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

.header-actions { display: flex; align-items: center; gap: 10px; }
.btn-admin { background: rgba(255, 0, 85, 0.2); color: #ff0055; border: 1px solid #ff0055; padding: 6px 12px; font-size: 10px; cursor: pointer; font-weight: bold; border-radius: 2px; transition: 0.2s; }
.btn-admin:hover { background: #ff0055; color: #fff; box-shadow: 0 0 10px rgba(255, 0, 85, 0.5); }

.list-tabs { display: flex; gap: 20px; border-bottom: 1px solid #21262d; margin-bottom: 15px; }
.tab-btn { background: none; border: none; color: #666; font-size: 11px; font-weight: bold; padding: 10px 0; cursor: pointer; position: relative; }
.tab-btn.active { color: #00d2ff; }
.tab-btn.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: #00d2ff; box-shadow: 0 0 10px #00d2ff; }
.readonly-tag { font-size: 9px; color: #ffd700; border: 1px solid rgba(255,215,0,0.3); padding: 2px 6px; border-radius: 4px; background: rgba(255,215,0,0.05); }

.btn-fork { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid #00d2ff; padding: 2px 8px; font-size: 9px; cursor: pointer; border-radius: 2px; transition: 0.2s; font-weight: bold; margin-right: 5px; }
.btn-fork:hover { background: #00d2ff; color: #000; box-shadow: 0 0 10px rgba(0, 210, 255, 0.5); }
</style>
