import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import Timeline from "../pages/Timeline.vue";
import Login from "../pages/Login.vue";
import Register from "../pages/Register.vue";
import NoteDetail from "../pages/NoteDetail.vue";
import UserProfile from "../pages/UserProfile.vue";
import DailyRecommend from "../pages/DailyRecommend.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", component: Timeline },
  { path: "/login", component: Login },
  { path: "/register", component: Register },
  { path: "/recommend", component: DailyRecommend },
  { path: "/user/:username", component: UserProfile, props: true },
  { path: "/:noteId", component: NoteDetail, props: true },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
