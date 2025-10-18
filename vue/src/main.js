import { createApp } from 'vue';
import App from './App.vue';

import { router, ROUTES } from './router/index.js';
import './styles/index.scss';

const routes = {
  install(app, options) {
    console.log(ROUTES);
    app.config.globalProperties.$routes = ROUTES;
  },
};

createApp(App).use(router).use(routes).mount('#project');
