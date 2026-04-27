<template>
  <div class="projects-view custom-scroll">
    <div v-if="!isAuthenticated" class="empty-state fade-in">
      <div class="empty-icon">📂</div>
      <h2>Project Workspace</h2>
      <p>Sign in from the user page to create, import, browse, and manage your simulation projects.</p>
      <button class="nav-btn" @click="router.push({ name: 'user', query: { redirect: '/projects' } })">
        Open User Page
      </button>
    </div>

    <div v-else class="project-dashboard fade-in">
      <div class="dashboard-main">
        <div class="section-create">
          <h3>INITIATE WORKSPACE</h3>
          <div class="create-grid">
            <div class="create-card upload" :class="{ processing: isProcessing.model }">
              <div class="icon">📂</div>
              <div class="c-title">UPLOAD SOURCE</div>
              <div class="c-desc">Parse .mo files</div>
              <input type="file" id="upload-model" accept=".mo,.txt" @change="handleModelUpload" :disabled="isAnyProcessing" hidden />
              <label for="upload-model" class="btn-action">
                {{ isProcessing.model ? 'PARSING...' : 'SELECT FILE' }}
              </label>
            </div>

            <div class="create-card import" :class="{ processing: isProcessing.project }">
              <div class="icon">📦</div>
              <div class="c-title">IMPORT ARCHIVE</div>
              <div class="c-desc">Restore .zip project</div>
              <input type="file" id="upload-project" accept=".zip" @change="handleProjectImport" :disabled="isAnyProcessing" hidden />
              <label for="upload-project" class="btn-action">
                {{ isProcessing.project ? 'RESTORING...' : 'SELECT ZIP' }}
              </label>
            </div>

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

        <div class="section-list" @click.self="cancelRenameIfEditing">
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

          <div class="list-tabs">
            <button class="tab-btn" :class="{ active: viewMode === 'personal' }" @click="viewMode = 'personal'">MY PROJECTS</button>
            <button class="tab-btn" :class="{ active: viewMode === 'public' }" @click="viewMode = 'public'">PUBLIC DISCOVERY</button>
          </div>

          <div v-if="viewMode === 'personal'" class="project-list custom-scroll" @click.self="cancelRenameIfEditing">
            <div v-for="project in recentProjects" :key="project.id || project.project_id" class="project-row" :class="{ editing: isProjectEditing(project) }" @click="handleProjectRowClick(project)">
              <div class="row-icon">❖</div>
              <div class="p-info">
                <div v-if="editingProjectId === (project.id || project.project_id)" class="p-name-edit" @click.stop>
                  <input
                    v-model="editingName"
                    class="p-name-input"
                    type="text"
                    @click.stop
                    @keyup.enter="commitRename(project)"
                    @keyup.esc="cancelRename"
                  />
                </div>
                <div v-else class="p-name">{{ project.name || 'Untitled Project' }}</div>
                <div class="p-meta">
                  <span class="meta-tag">ID: {{ String(project.id || project.project_id || '').slice(0, 8) }}</span>
                  <span class="meta-dot">&bull;</span>
                  <span>{{ formatDate(project.created_at) }}</span>
                </div>
              </div>
              <div class="p-actions">
                <template v-if="editingProjectId === (project.id || project.project_id)">
                  <button class="btn-rename" @click.stop="commitRename(project)" :disabled="isAnyProcessing">SAVE</button>
                  <button class="btn-rename cancel" @click.stop="cancelRename" :disabled="isAnyProcessing">CANCEL</button>
                </template>
                <template v-else>
                  <button class="btn-jump" @click.stop="openWorkspace(project)" :disabled="isAnyProcessing">WS</button>
                  <button class="btn-jump alt" @click.stop="openDataSpace(project)" :disabled="isAnyProcessing">DS</button>
                  <button class="btn-rename" @click.stop="startRename(project)" :disabled="isAnyProcessing">RENAME</button>
                </template>
                <button class="btn-export" @click.stop="handleExport(project)">EXPORT</button>
                <button class="btn-del" @click.stop="deleteProject(project.id || project.project_id)">✕</button>
              </div>
            </div>
            <div v-if="recentProjects.length === 0" class="empty-list">No recent projects found.</div>
          </div>

          <div v-else class="project-list custom-scroll">
            <div v-for="project in publicProjects" :key="project.id" class="project-row" @click="selectProject(project)">
              <div class="row-icon">🌍</div>
              <div class="p-info">
                <div class="p-name">{{ project.name || 'Public Project' }}</div>
                <div class="p-meta">
                  <span class="meta-tag">BY: {{ project.user_id ? String(project.user_id).slice(0, 8) : 'System' }}</span>
                  <span class="meta-dot">&bull;</span>
                  <span>{{ formatDate(project.created_at) }}</span>
                </div>
              </div>
              <div class="p-actions">
                <button class="btn-fork" @click.stop="handleFork(project.id)">FORK</button>
                <span class="readonly-tag">PREVIEW</span>
              </div>
            </div>
            <div v-if="publicProjects.length === 0" class="empty-list">No public projects available.</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useProjectWorkspace } from '../composables/useProjectWorkspace';

const router = useRouter();
const {
  isAuthenticated,
  recentProjects,
  publicProjects,
  viewMode,
  isProcessing,
  isAnyProcessing,
  lastProjectId,
  editingProjectId,
  editingName,
  resumeProject,
  selectProject,
  handleFork,
  deleteProject,
  formatDate,
  handleExport,
  startRename,
  cancelRename,
  commitRename,
  handleModelUpload,
  handleProjectImport,
  openDemo
} = useProjectWorkspace();

const getProjectId = (project) => project?.id || project?.project_id;

const isProjectEditing = (project) => getProjectId(project) === editingProjectId.value;

const cancelRenameIfEditing = () => {
  if (editingProjectId.value) {
    cancelRename();
  }
};

const handleProjectRowClick = (project) => {
  if (isProjectEditing(project)) {
    return;
  }
  selectProject(project);
};

const openWorkspace = (project) => {
  const projectId = getProjectId(project);
  if (!projectId) return;
  localStorage.setItem('tricys_last_pid', String(projectId));
  router.push({ name: 'config', query: { projectId } });
};

const openDataSpace = (project) => {
  const projectId = getProjectId(project);
  if (!projectId) return;
  localStorage.setItem('tricys_last_pid', String(projectId));
  router.push({ name: 'pages', query: { projectId } });
};
</script>

<style scoped>
.projects-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #05070a;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Inter', sans-serif;
  overflow-x: hidden;
  overflow-y: auto;
  padding: clamp(18px, 3vw, 32px);
  box-sizing: border-box;
}

.empty-state {
  margin: clamp(24px, 6vh, 56px) auto;
  width: min(520px, calc(100% - 48px));
  padding: 36px;
  border: 1px solid #30363d;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.96), rgba(9, 13, 18, 0.92));
  text-align: center;
  box-shadow: 0 24px 50px rgba(0, 0, 0, 0.35);
}

.empty-icon {
  font-size: 34px;
  margin-bottom: 14px;
}

.empty-state h2 {
  margin: 0 0 10px;
  font-size: 22px;
}

.empty-state p {
  margin: 0 0 22px;
  color: #8b949e;
  line-height: 1.55;
}

.nav-btn {
  background: #00d2ff;
  color: #03131a;
  border: none;
  border-radius: 8px;
  height: 40px;
  padding: 0 18px;
  font-weight: 700;
  cursor: pointer;
}

.nav-btn.secondary {
  background: transparent;
  color: #9fb1c3;
  border: 1px solid #334155;
}

.project-dashboard {
  width: min(1480px, 100%);
  min-height: 100%;
  background: #0d1117;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #1c2128;
  border-radius: 22px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
}

.dashboard-main {
  flex: 1 1 auto;
  display: flex;
  overflow: hidden;
  order: 1;
  min-height: 0;
}

.section-create { flex: 1.08; min-width: 0; padding: 30px; border-right: 1px solid #30363d; background: linear-gradient(135deg, rgba(0,0,0,0.2), transparent); overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }
.section-create h3, .section-list h3 { font-size: 12px; color: #666; font-weight: bold; letter-spacing: 1px; margin-bottom: 20px; }

.create-grid { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 20px; }
.create-card { background: rgba(5, 7, 10, 0.5); border: 1px solid #30363d; padding: 20px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; transition: 0.2s; position: relative; flex: 1 1 0; min-height: 150px; }
.create-card:hover { border-color: #00d2ff; background: rgba(0, 210, 255, 0.02); transform: translateY(-2px); }
.create-card .icon { font-size: 24px; margin-bottom: 10px; }
.c-title { font-weight: bold; color: #fff; font-size: 14px; margin-bottom: 5px; }
.c-desc { font-size: 11px; color: #888; margin-bottom: 15px; }
.btn-action { width: 100%; padding: 10px; background: transparent; border: 1px solid #00d2ff; color: #00d2ff; font-weight: bold; font-size: 11px; cursor: pointer; text-transform: uppercase; transition: 0.2s; display: block; box-sizing: border-box; }
.btn-action:hover, .create-card:hover .btn-action { background: #00d2ff; color: #000; }
.create-card.demo:hover { border-color: #ff00ff; }
.create-card.demo .btn-action { border-color: #ff00ff; color: #ff00ff; }
.create-card.demo .btn-action:hover { background: #ff00ff; color: #fff; }

.section-list { flex: 1; min-width: 0; padding: 30px; background: #0b0e14; display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid #1c2128; }
.project-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 0; padding-right: 5px; }
.project-row { padding: 12px 15px; background: #11141a; border: 1px solid #21262d; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease; gap: 15px; }
.project-row:hover { border-color: #00d2ff; background: rgba(0, 210, 255, 0.05); transform: translateX(3px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.project-row.editing { align-items: flex-start; flex-wrap: wrap; cursor: default; }
.project-row.editing:hover { transform: none; }
.row-icon { color: #30363d; font-size: 16px; transition: 0.2s; }
.project-row:hover .row-icon { color: #00d2ff; }
.p-info { flex: 1; min-width: 0; }
.project-row.editing .p-info { min-width: min(420px, 100%); }
.p-name { font-weight: bold; color: #eee; font-size: 13px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.5px; }
.project-row:hover .p-name { color: #fff; text-shadow: 0 0 10px rgba(0,210,255,0.5); }
.p-name-edit { margin-bottom: 4px; width: min(100%, 560px); }
.p-name-input { width: 100%; max-width: 100%; box-sizing: border-box; background: #05070a; border: 1px solid #00d2ff; color: #fff; padding: 6px 8px; border-radius: 4px; font-size: 12px; }
.p-name-input:focus { outline: none; box-shadow: 0 0 8px rgba(0, 210, 255, 0.35); }
.p-meta { font-size: 10px; color: #666; font-family: monospace; display: flex; align-items: center; gap: 6px; }
.meta-tag { background: #1c2128; padding: 2px 5px; border-radius: 3px; color: #8b949e; }
.meta-dot { color: #30363d; }
.p-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.project-row.editing .p-actions { width: 100%; justify-content: flex-start; padding-left: 31px; }
.btn-jump { background: rgba(0, 210, 255, 0.08); color: #9cecff; border: 1px solid rgba(0, 210, 255, 0.3); padding: 4px 8px; font-size: 9px; cursor: pointer; border-radius: 4px; transition: 0.2s; font-weight: bold; min-width: 32px; }
.btn-jump:hover:not(:disabled) { background: rgba(0, 210, 255, 0.16); color: #fff; border-color: rgba(0, 210, 255, 0.48); box-shadow: 0 0 10px rgba(0, 210, 255, 0.18); }
.btn-jump.alt { background: rgba(0, 255, 170, 0.06); color: #7cf7d4; border-color: rgba(0, 255, 170, 0.24); }
.btn-jump.alt:hover:not(:disabled) { background: rgba(0, 255, 170, 0.14); border-color: rgba(0, 255, 170, 0.42); box-shadow: 0 0 10px rgba(0, 255, 170, 0.14); }
.btn-jump:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-export { background: rgba(0, 255, 136, 0.1); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); padding: 4px 8px; font-size: 9px; cursor: pointer; border-radius: 4px; transition: 0.2s; font-weight: bold; }
.btn-export:hover { background: #00ff88; color: #000; border-color: #00ff88; box-shadow: 0 0 10px rgba(0, 255, 136, 0.4); }
.btn-rename { background: rgba(0, 210, 255, 0.08); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.4); padding: 4px 8px; font-size: 9px; cursor: pointer; border-radius: 4px; transition: 0.2s; font-weight: bold; }
.btn-rename:hover:not(:disabled) { background: #00d2ff; color: #000; border-color: #00d2ff; box-shadow: 0 0 10px rgba(0, 210, 255, 0.35); }
.btn-rename:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-rename.cancel { background: rgba(255, 82, 82, 0.08); color: #ff5252; border-color: rgba(255, 82, 82, 0.4); }
.btn-rename.cancel:hover:not(:disabled) { background: #ff5252; color: #000; border-color: #ff5252; box-shadow: 0 0 10px rgba(255, 82, 82, 0.35); }
.btn-del { width: 24px; height: 24px; border: 1px solid transparent; background: transparent; color: #484f58; cursor: pointer; font-size: 14px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.btn-del:hover { background: rgba(255, 82, 82, 0.1); border-color: rgba(255, 82, 82, 0.3); color: #ff5252; }
.empty-list { text-align: center; color: #444; font-size: 12px; padding: 30px; border: 1px dashed #30363d; border-radius: 6px; background: rgba(255,255,255,0.01); }

.resume-group { margin-bottom: 25px; flex-shrink: 0; }
.resume-card { background: linear-gradient(90deg, rgba(0, 210, 255, 0.1), rgba(0,0,0,0)); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 6px; padding: 12px 15px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
.resume-card:hover { border-color: #00d2ff; background: linear-gradient(90deg, rgba(0, 210, 255, 0.2), rgba(0,0,0,0)); transform: translateX(2px); }
.resume-card .icon { color: #00d2ff; font-size: 14px; }
.r-info { flex: 1; min-width: 0; }
.r-label { font-size: 9px; color: #00d2ff; font-weight: bold; letter-spacing: 1px; margin-bottom: 2px; }
.r-name { font-size: 12px; color: #fff; font-weight: bold; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r-arrow { color: #00d2ff; font-weight: bold; font-size: 14px; }
.divider-h { height: 1px; background: #30363d; margin-top: 20px; }

.fade-in { animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

.list-tabs { display: flex; gap: 20px; border-bottom: 1px solid #21262d; margin-bottom: 15px; }
.tab-btn { background: none; border: none; color: #666; font-size: 11px; font-weight: bold; padding: 10px 0; cursor: pointer; position: relative; }
.tab-btn.active { color: #00d2ff; }
.tab-btn.active::after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 2px; background: #00d2ff; box-shadow: 0 0 10px #00d2ff; }
.readonly-tag { font-size: 9px; color: #ffd700; border: 1px solid rgba(255,215,0,0.3); padding: 2px 6px; border-radius: 4px; background: rgba(255,215,0,0.05); }
.btn-fork { background: rgba(0, 210, 255, 0.1); color: #00d2ff; border: 1px solid #00d2ff; padding: 2px 8px; font-size: 9px; cursor: pointer; border-radius: 2px; transition: 0.2s; font-weight: bold; margin-right: 5px; }
.btn-fork:hover { background: #00d2ff; color: #000; box-shadow: 0 0 10px rgba(0, 210, 255, 0.5); }

@media (max-width: 1180px) {
  .dashboard-main {
    flex-direction: column;
    overflow-y: auto;
  }

  .section-create {
    flex: 1;
    border-right: none;
    border-bottom: 1px solid #30363d;
  }

  .section-list {
    border-left: none;
  }

  .create-grid {
    flex: none;
  }
}

@media (max-width: 760px) {
  .projects-view {
    padding: 14px;
  }

  .project-dashboard {
    border-radius: 16px;
  }

  .section-create,
  .section-list {
    padding: 22px 18px;
  }

  .project-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .p-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-height: 840px) {
  .project-dashboard {
    min-height: auto;
  }

  .project-dashboard {
    min-height: max-content;
  }
}
</style>