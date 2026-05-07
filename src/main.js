import { createApp } from 'vue'
import './styles/main.css';
import App from './App.vue'
import router from './app/router'

createApp(App).use(router).mount('#app')