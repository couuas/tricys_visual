<template>
  <div class="user-view">
    <div class="content">
      <div v-if="!isAuthenticated" class="auth-container fade-in">
        <div class="auth-header">
          <div class="auth-logo">TRICYS</div>
          <div class="auth-sub">TRitium Integrated CYcle Simulation</div>
        </div>

        <div class="auth-toggle">
          <button class="toggle-btn" :class="{ active: authMode === 'login' }" @click="authMode = 'login'">LOGIN</button>
          <button class="toggle-btn" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">REGISTER</button>
        </div>

        <div v-if="authMode === 'login'" class="auth-form">
          <p class="subtitle">Enter credentials to access your workspace.</p>
          <div class="form-group">
            <label>USERNAME</label>
            <input v-model="loginForm.username" type="text" placeholder="Identity..." autofocus />
          </div>
          <div class="form-group">
            <label>PASSWORD</label>
            <input v-model="loginForm.password" type="password" placeholder="Secured..." @keyup.enter="handleLogin" />
          </div>
          <button class="action-btn" :disabled="loading" @click="handleLogin">
            {{ loading ? 'VERIFYING...' : 'ACCESS SYSTEM' }}
          </button>
          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>

        <div v-else class="auth-form">
          <p class="subtitle">Create new operator identity.</p>
          <div class="form-group">
            <label>USERNAME *</label>
            <input v-model="regForm.username" type="text" placeholder="Unique identifier" />
          </div>
          <div class="form-group">
            <label>PASSWORD *</label>
            <input v-model="regForm.password" type="password" placeholder="Passphrase" />
          </div>
          <div class="form-group">
            <label>FULL NAME</label>
            <input v-model="regForm.full_name" type="text" placeholder="Display name" />
          </div>
          <div class="form-group">
            <label>EMAIL</label>
            <input v-model="regForm.email" type="text" placeholder="Contact (Optional)" />
          </div>
          <button class="action-btn" :disabled="loading" @click="handleRegister">
            {{ loading ? 'REGISTERING...' : 'CREATE IDENTITY' }}
          </button>
          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>
      </div>

      <div v-else class="profile-dashboard fade-in">
        <section class="hero-card">
          <div class="hero-avatar">{{ userInitials }}</div>
          <div class="hero-copy">
            <p class="eyebrow">Operator Identity</p>
            <h1>{{ currentUser?.full_name || currentUser?.username }}</h1>
            <p class="hero-sub">Account access stays here. Project creation, import, browsing, and management now live on the dedicated Projects page.</p>
          </div>
        </section>

        <section class="info-grid">
          <article class="info-card">
            <h3>Account</h3>
            <div class="info-row">
              <span class="info-label">Username</span>
              <span class="info-value">{{ currentUser?.username || '--' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Full Name</span>
              <span class="info-value">{{ currentUser?.full_name || '--' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">{{ currentUser?.email || '--' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Role</span>
              <span class="info-value">{{ isAdmin ? 'Administrator' : 'Operator' }}</span>
            </div>
          </article>

          <article class="info-card">
            <h3>Workspace</h3>
            <div class="info-row compact">
              <span class="info-label">Last Project</span>
              <span class="info-value mono">{{ lastProjectId || 'None' }}</span>
            </div>
            <div class="quick-actions">
              <button class="panel-btn primary" @click="router.push({ name: 'projects' })">Open Projects</button>
              <button class="panel-btn" :disabled="!lastProjectId" @click="resumeLastProject">Resume Last Project</button>
              <button class="panel-btn" :disabled="isConsistencyRunning" @click="handleConsistencyFix">
                {{ isConsistencyRunning ? 'FIXING...' : 'Fix Consistency' }}
              </button>
              <button v-if="isAdmin" class="panel-btn admin" @click="router.push({ name: 'admin' })">Open Admin Panel</button>
              <button class="panel-btn danger" @click="handleLogout">Sign Out</button>
            </div>
          </article>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useProjectWorkspace } from '../composables/useProjectWorkspace';
import { useSimulation } from '../composables/useSimulation';
import { $notify } from '../utils/notification';

const router = useRouter();
const route = useRoute();
const { isAuthenticated, currentUser, login, register, logout } = useAuth();
const { resetSession } = useSimulation();
const { lastProjectId, handleConsistencyFix, isConsistencyRunning } = useProjectWorkspace({ autoLoad: false });

const authMode = ref('login');
const loading = ref(false);
const errorMsg = ref('');
const loginForm = reactive({ username: '', password: '' });
const regForm = reactive({ username: '', password: '', full_name: '', email: '' });

const userInitials = computed(() => {
  if (!currentUser.value) {
    return '?';
  }
  const name = currentUser.value.full_name || currentUser.value.username || '?';
  return name.slice(0, 2).toUpperCase();
});

const isAdmin = computed(() => Boolean(currentUser.value && (currentUser.value.is_superuser === true || currentUser.value.is_superuser === 1)));

const resolvePostAuthRoute = () => {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.trim()) {
    return redirect;
  }
  return { name: 'projects' };
};

const handleLogin = async () => {
  if (!loginForm.username || !loginForm.password) {
    errorMsg.value = 'Credentials required';
    return;
  }

  loading.value = true;
  errorMsg.value = '';
  const response = await login(loginForm.username, loginForm.password);
  loading.value = false;

  if (!response.success) {
    errorMsg.value = response.message;
    $notify({ title: 'ACCESS DENIED', message: response.message, type: 'error' });
    return;
  }

  $notify({ title: 'ACCESS GRANTED', message: `Welcome, ${response.user.username}.`, type: 'success' });
  router.push(resolvePostAuthRoute());
};

const handleRegister = async () => {
  if (!regForm.username) {
    errorMsg.value = 'Username required';
    return;
  }

  loading.value = true;
  errorMsg.value = '';
  const response = await register(regForm);
  loading.value = false;

  if (!response.success) {
    errorMsg.value = response.message;
    $notify({ title: 'REGISTRATION FAILED', message: response.message, type: 'error' });
    return;
  }

  $notify({ title: 'IDENTITY CREATED', message: `Registered as ${response.user.username}.`, type: 'success' });
  router.push(resolvePostAuthRoute());
};

const handleLogout = async () => {
  await resetSession();
  logout();
  $notify({ title: 'LOGOUT', message: 'Session terminated.', type: 'info' });
  router.push({ name: 'user' });
};

const resumeLastProject = async () => {
  if (!lastProjectId.value) {
    return;
  }
  localStorage.setItem('tricys_last_pid', lastProjectId.value);
  await resetSession();
  router.push({ name: 'config', query: { projectId: lastProjectId.value } });
};
</script>

<style scoped>
.user-view { width: 100%; height: 100%; background: #05070a; color: #fff; display: flex; flex-direction: column; font-family: 'Inter', sans-serif; overflow: hidden; }
.content { flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: radial-gradient(circle at center, #0d1117 0%, #05070a 70%); }
.auth-container { width: 380px; margin: auto; background: rgba(13, 17, 23, 0.9); border: 1px solid #30363d; border-radius: 8px; backdrop-filter: blur(10px); padding: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
.auth-header { text-align: center; margin-bottom: 25px; }
.auth-logo { font-size: 24px; font-weight: bold; color: #00ffff; letter-spacing: 2px; }
.auth-sub { font-size: 11px; color: #666; margin-top: 5px; }
.auth-toggle { display: flex; border-bottom: 1px solid #30363d; margin-bottom: 20px; }
.toggle-btn { flex: 1; padding: 10px; background: transparent; border: none; color: #666; font-weight: bold; cursor: pointer; font-size: 11px; transition: 0.2s; }
.toggle-btn.active { color: #00d2ff; border-bottom: 2px solid #00d2ff; background: rgba(0, 210, 255, 0.05); }
.auth-form { display: flex; flex-direction: column; gap: 15px; }
.subtitle { margin: 0 0 10px; font-size: 12px; color: #888; text-align: center; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-size: 10px; font-weight: bold; color: #555; letter-spacing: 1px; }
.form-group input { background: #05070a; border: 1px solid #30363d; color: #fff; padding: 10px; border-radius: 4px; font-family: monospace; transition: 0.2s; }
.form-group input:focus { border-color: #00d2ff; outline: none; }
.action-btn { margin-top: 10px; padding: 12px; background: #00d2ff; border: none; border-radius: 4px; color: #000; font-weight: bold; cursor: pointer; transition: 0.2s; }
.action-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 15px rgba(0, 210, 255, 0.3); background: #fff; }
.error-msg { font-size: 11px; color: #ff5252; text-align: center; margin: 0; }
.profile-dashboard { width: min(1100px, calc(100% - 48px)); margin: 32px auto; display: flex; flex-direction: column; gap: 24px; }
.hero-card { display: flex; align-items: center; gap: 24px; padding: 28px 30px; border: 1px solid #243041; border-radius: 20px; background: linear-gradient(135deg, rgba(7, 12, 18, 0.96), rgba(13, 17, 23, 0.9)); box-shadow: 0 22px 50px rgba(0, 0, 0, 0.32); }
.hero-avatar { width: 88px; height: 88px; border-radius: 24px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(0, 210, 255, 0.2), rgba(0, 123, 255, 0.16)); border: 1px solid rgba(0, 210, 255, 0.28); color: #9ae6ff; font-size: 28px; font-weight: 800; }
.eyebrow { margin: 0 0 8px; color: #00d2ff; font-size: 11px; text-transform: uppercase; letter-spacing: 1.4px; }
.hero-copy h1 { margin: 0; font-size: 28px; }
.hero-sub { margin: 10px 0 0; color: #8b949e; line-height: 1.6; max-width: 720px; }
.info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.info-card { padding: 24px; border-radius: 18px; border: 1px solid #243041; background: rgba(9, 13, 19, 0.92); }
.info-card h3 { margin: 0 0 18px; font-size: 14px; letter-spacing: 1px; color: #dbe8f5; text-transform: uppercase; }
.info-row { display: flex; justify-content: space-between; gap: 18px; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.info-row.compact { align-items: center; }
.info-label { color: #7d8ea3; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; }
.info-value { color: #f1f5f9; font-size: 14px; text-align: right; }
.info-value.mono { font-family: 'JetBrains Mono', monospace; }
.quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
.panel-btn { height: 42px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #dbe8f5; cursor: pointer; font-weight: 700; transition: 0.2s; }
.panel-btn:hover:not(:disabled) { border-color: #00d2ff; color: #00d2ff; }
.panel-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.panel-btn.primary { background: linear-gradient(135deg, #00d2ff, #007bff); color: #02131a; border-color: transparent; }
.panel-btn.primary:hover:not(:disabled) { color: #02131a; filter: brightness(1.08); }
.panel-btn.admin { border-color: rgba(255, 0, 85, 0.45); color: #ff5b8a; }
.panel-btn.admin:hover:not(:disabled) { border-color: #ff0055; color: #ff0055; }
.fade-in { animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 900px) {
  .profile-dashboard { width: calc(100% - 24px); margin: 16px auto; }
  .hero-card { flex-direction: column; align-items: flex-start; }
  .info-grid { grid-template-columns: 1fr; }
  .quick-actions { grid-template-columns: 1fr; }
}
</style>
