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
    radial-gradient(circle at 18% 10%, rgba(199, 223, 255, 0.78), transparent 30%),
    radial-gradient(circle at 88% 18%, rgba(17, 181, 217, 0.12), transparent 28%),
    linear-gradient(135deg, #f4f8ff 0%, #ffffff 52%, #e8f1ff 100%);
}

.login-card {
  width: min(420px, 100%);
  padding: 34px;
  border: 1px solid #cfe0ff;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 28px 80px rgba(28, 60, 112, 0.16);
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
  border: 1px solid rgba(207, 224, 255, 0.9);
  border-radius: 20px;
  color: #ffffff;
  background: linear-gradient(135deg, #3478f6, #11b5d9);
  font-size: 28px;
  font-weight: 900;
  box-shadow: 0 14px 28px rgba(52, 120, 246, 0.24);
}

.login-brand p {
  margin: 0 0 6px;
  color: #3478f6;
  font-size: 12px;
  letter-spacing: 0.18em;
}

.login-brand h1 {
  margin: 0;
  color: #101c2e;
  font-size: 22px;
  line-height: 1.3;
}

.login-form {
  display: grid;
  gap: 18px;
}

.login-form label {
  display: grid;
  gap: 8px;
  color: #101c2e;
  font-size: 14px;
  font-weight: 700;
}

.login-form input {
  height: 46px;
  padding: 0 14px;
  border: 1px solid #d6e2f5;
  border-radius: 14px;
  background: #ffffff;
  color: #101c2e;
  font-size: 15px;
}

.login-form input:focus {
  border-color: #3478f6;
  outline: 3px solid rgba(52, 120, 246, 0.16);
}

.login-error {
  margin: 0;
  color: #dc2626;
  font-size: 14px;
}

.login-submit {
  height: 48px;
  border: 0;
  border-radius: 16px;
  color: #ffffff;
  background: #3478f6;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(52, 120, 246, 0.22);
}

.login-submit:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
