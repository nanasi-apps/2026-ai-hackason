import { createApp } from "vue";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { router } from "./router";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);
app.use(VueQueryPlugin);
app.use(router);
app.mount("#app");
