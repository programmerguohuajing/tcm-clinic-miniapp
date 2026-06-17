<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { loginAdmin } from "../services/auth";

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const error = ref("");
const form = reactive({
  phone: "",
  password: ""
});

onMounted(() => {
  if (import.meta.env.DEV) {
    form.phone = "13800000000";
    form.password = "admin123";
  }
});

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await loginAdmin(form);
    router.replace(String(route.query.redirect || "/"));
  } catch (err) {
    error.value = err.message || "登录失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <div class="login-brand">
        <span class="login-seal">掌</span>
        <div>
          <p>TCM ADMIN</p>
          <h1>青囊中医馆管理系统</h1>
        </div>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label>
          <span>管理员手机号</span>
          <input v-model.trim="form.phone" autocomplete="username" placeholder="请输入手机号" />
        </label>
        <label>
          <span>登录密码</span>
          <input v-model="form.password" autocomplete="current-password" placeholder="请输入密码" type="password" />
        </label>
        <p v-if="error" class="login-error">{{ error }}</p>
        <button class="login-submit" :disabled="loading" type="submit">
          {{ loading ? "登录中..." : "进入管理端" }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  background:
    radial-gradient(circle at 20% 18%, rgba(20, 184, 166, 0.16), transparent 30%),
    linear-gradient(135deg, #f5f8fa 0%, #e6f6f8 52%, #d9e2ec 100%);
}

.login-card {
  width: min(420px, 100%);
  padding: 34px;
  border: 1px solid #d9e2ec;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 70px rgba(15, 47, 61, 0.14);
}

.login-brand {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 30px;
}

.login-seal {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(14, 116, 144, 0.18);
  border-radius: 18px;
  color: #0e7490;
  background: #e6f6f8;
  font-size: 28px;
  font-weight: 800;
}

.login-brand p {
  margin: 0 0 6px;
  color: #0e7490;
  font-size: 12px;
  letter-spacing: 0.18em;
}

.login-brand h1 {
  margin: 0;
  color: #102a43;
  font-size: 22px;
}

.login-form {
  display: grid;
  gap: 18px;
}

.login-form label {
  display: grid;
  gap: 8px;
  color: #102a43;
  font-size: 14px;
  font-weight: 700;
}

.login-form input {
  height: 46px;
  padding: 0 14px;
  border: 1px solid #d9e2ec;
  border-radius: 12px;
  background: #ffffff;
  color: #102a43;
  font-size: 15px;
}

.login-form input:focus {
  border-color: #0e7490;
  outline: 3px solid rgba(14, 116, 144, 0.14);
}

.login-error {
  margin: 0;
  color: #dc2626;
  font-size: 14px;
}

.login-submit {
  height: 48px;
  border: 0;
  border-radius: 14px;
  color: #ffffff;
  background: #0e7490;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
}

.login-submit:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
