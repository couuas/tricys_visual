import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from './useAuth';
import { useSimulation } from './useSimulation';
import { $notify } from '../utils/notification';
import { projectApi } from '../api/project';

export function useProjectWorkspace(options = {}) {
  const autoLoad = options.autoLoad !== false;
  const router = useRouter();
  const { isAuthenticated, currentUser } = useAuth();
  const { resetSession } = useSimulation();

  const recentProjects = ref([]);
  const publicProjects = ref([]);
  const viewMode = ref('personal');
  const isProcessing = reactive({ model: false, project: false });
  const isConsistencyRunning = ref(false);
  const lastProjectId = ref(localStorage.getItem('tricys_last_pid'));
  const editingProjectId = ref(null);
  const editingName = ref('');

  const isAnyProcessing = computed(() => isProcessing.model || isProcessing.project);

  const loadProjects = async () => {
    if (!isAuthenticated.value) {
      recentProjects.value = [];
      publicProjects.value = [];
      return;
    }

    try {
      const [personal, publicListing] = await Promise.all([
        projectApi.listProjects(),
        projectApi.listPublicProjects()
      ]);

      recentProjects.value = Array.isArray(personal) ? personal : (personal.items || []);
      recentProjects.value.sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

      publicProjects.value = Array.isArray(publicListing) ? publicListing : (publicListing.items || []);
      publicProjects.value.sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
    } catch (error) {
      console.error('Load projects failed', error);
      $notify({ title: 'LOAD FAILED', message: 'Could not fetch project lists.', type: 'error' });
    }
  };

  const openProject = async (projectId) => {
    if (!projectId) {
      return;
    }

    localStorage.setItem('tricys_last_pid', projectId);
    lastProjectId.value = projectId;
    await resetSession();
    router.push({ name: 'config', query: { projectId } });
  };

  const resumeProject = () => openProject(lastProjectId.value);

  const selectProject = async (project) => {
    const projectId = project.id || project.project_id;
    await openProject(projectId);
  };

  const handleFork = async (projectId) => {
    if (!projectId) {
      return;
    }

    isProcessing.project = true;
    try {
      await projectApi.forkProject(projectId);
      $notify({ title: 'PROJECT CLONED', message: 'The project has been added to your workspace.', type: 'success' });
      await loadProjects();
      viewMode.value = 'personal';
    } catch (error) {
      $notify({ title: 'FORK FAILED', message: error.response?.data?.detail || 'Could not clone project.', type: 'error' });
    } finally {
      isProcessing.project = false;
    }
  };

  const deleteProject = async (projectId) => {
    if (!projectId || !window.confirm('Permanently delete this project?')) {
      return;
    }

    try {
      await projectApi.deleteProject(projectId);
      if (lastProjectId.value === projectId) {
        localStorage.removeItem('tricys_last_pid');
        lastProjectId.value = null;
      }
      $notify({ title: 'DELETED', message: 'Project removed.', type: 'success' });
      await loadProjects();
    } catch (_error) {
      $notify({ title: 'ERROR', message: 'Delete failed.', type: 'error' });
    }
  };

  const formatDate = (iso) => {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  const handleExport = async (project) => {
    const projectId = project.id || project.project_id;
    if (!projectId || isAnyProcessing.value) {
      return;
    }

    isProcessing.project = true;
    try {
      const blob = await projectApi.exportProject(projectId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project_${project.name || projectId}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      $notify({ title: 'EXPORT SUCCESS', message: 'Project archive downloaded.', type: 'success' });
    } catch (_error) {
      $notify({ title: 'EXPORT FAILED', message: 'Could not generate archive.', type: 'error' });
    } finally {
      isProcessing.project = false;
    }
  };

  const handleConsistencyFix = async () => {
    if (isConsistencyRunning.value) {
      return;
    }

    isConsistencyRunning.value = true;
    try {
      const response = await projectApi.checkConsistency(true);
      const fixed = Array.isArray(response?.fixed) ? response.fixed.length : 0;
      const missing = Array.isArray(response?.missing_goview) ? response.missing_goview.length : 0;
      const orphan = Array.isArray(response?.orphan_goview) ? response.orphan_goview.length : 0;
      $notify({
        title: 'CONSISTENCY CHECK',
        message: `Fixed ${fixed}. Missing ${missing}. Orphan ${orphan}.`,
        type: 'success'
      });
    } catch (_error) {
      $notify({ title: 'CONSISTENCY FAILED', message: 'Could not fix consistency.', type: 'error' });
    } finally {
      isConsistencyRunning.value = false;
    }
  };

  const startRename = (project) => {
    const projectId = project.id || project.project_id;
    if (!projectId || isAnyProcessing.value) {
      return;
    }
    editingProjectId.value = projectId;
    editingName.value = project.name || 'Untitled Project';
  };

  const cancelRename = () => {
    editingProjectId.value = null;
    editingName.value = '';
  };

  const commitRename = async (project) => {
    const projectId = project.id || project.project_id;
    if (!projectId || isAnyProcessing.value) {
      return;
    }

    const currentName = project.name || 'Untitled Project';
    const nextName = String(editingName.value || '').trim();
    if (!nextName) {
      $notify({ title: 'RENAME FAILED', message: 'Name cannot be empty.', type: 'error' });
      return;
    }
    if (nextName === currentName) {
      cancelRename();
      return;
    }

    isProcessing.project = true;
    try {
      const response = await projectApi.renameProject(projectId, nextName);
      project.name = response?.name || nextName;
      $notify({ title: 'RENAMED', message: 'Project name updated.', type: 'success' });
      cancelRename();
    } catch (_error) {
      $notify({ title: 'RENAME FAILED', message: 'Could not update project name.', type: 'error' });
    } finally {
      isProcessing.project = false;
    }
  };

  const handleModelUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    isProcessing.model = true;
    try {
      const project = await projectApi.createProject(file);
      $notify({ title: 'SYSTEM READY', message: 'Topology parsed successfully.', type: 'success' });
      localStorage.setItem('tricys_last_pid', project.project_id);
      lastProjectId.value = project.project_id;
      router.push({ name: 'config', query: { projectId: project.project_id } });
    } catch (_error) {
      $notify({ title: 'PARSING ERROR', message: 'Failed to upload/parse model.', type: 'error' });
    } finally {
      isProcessing.model = false;
      event.target.value = '';
    }
  };

  const handleProjectImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    isProcessing.project = true;
    try {
      const response = await projectApi.importProject(file);
      if (!response?.project_id) {
        throw new Error('Import failed');
      }
      $notify({ title: 'STATE RESTORED', message: 'Project environment loaded.', type: 'success' });
      await loadProjects();
    } catch (_error) {
      $notify({ title: 'IMPORT FAILED', message: 'Could not restore project.', type: 'error' });
    } finally {
      isProcessing.project = false;
      event.target.value = '';
    }
  };

  const openDemo = async () => {
    if (isAnyProcessing.value) {
      return;
    }

    isProcessing.project = true;
    try {
      const response = await projectApi.createDemo();
      if (!response?.project_id) {
        throw new Error('Invalid response');
      }
      $notify({ title: 'DEMO READY', message: 'Demo environment initialized.', type: 'success' });
      localStorage.setItem('tricys_last_pid', response.project_id);
      lastProjectId.value = response.project_id;
      router.push({ name: 'config', query: { projectId: response.project_id } });
    } catch (_error) {
      $notify({ title: 'DEMO FAILED', message: 'Could not create demo project. Ensure backend supports demo mode.', type: 'error' });
    } finally {
      isProcessing.project = false;
    }
  };

  onMounted(() => {
    if (autoLoad && isAuthenticated.value) {
      loadProjects();
    }
  });

  watch(isAuthenticated, (authenticated) => {
    if (autoLoad && authenticated) {
      loadProjects();
    } else {
      recentProjects.value = [];
      publicProjects.value = [];
    }
  });

  return {
    currentUser,
    isAuthenticated,
    recentProjects,
    publicProjects,
    viewMode,
    isProcessing,
    isAnyProcessing,
    isConsistencyRunning,
    lastProjectId,
    editingProjectId,
    editingName,
    loadProjects,
    resumeProject,
    selectProject,
    handleFork,
    deleteProject,
    formatDate,
    handleExport,
    handleConsistencyFix,
    startRename,
    cancelRename,
    commitRename,
    handleModelUpload,
    handleProjectImport,
    openDemo
  };
}