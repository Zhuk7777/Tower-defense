import { createWebHistory, createRouter } from 'vue-router';

import MainPage from '../pages/MainPage.vue';

import Layout from '@/modules/Layout.vue';
import GamePage from '@/pages/GamePage.vue';
import InfoPage from '@/pages/InfoPage.vue';

export const ROUTES = {
  MAIN: 'MAIN',
  GAME: 'GAME',
  INFO: 'INFO',
};

const routes = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        name: ROUTES.MAIN,
        path: '',
        component: MainPage,
      },
      {
        name: ROUTES.GAME,
        path: 'game',
        component: GamePage,
      },
      {
        name: ROUTES.INFO,
        path: 'info',
        component: InfoPage,
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory('/'),
  routes,
});
