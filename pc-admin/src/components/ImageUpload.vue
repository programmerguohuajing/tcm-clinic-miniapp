<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { getToken } from "../services/auth";

const props = defineProps({
  modelValue: {
    type: String,
    default: ""
  },
  label: {
    type: String,
    default: "头像图片"
  }
});

const emit = defineEmits(["update:modelValue"]);

const uploading = ref(false);
const inputRef = ref(null);

async function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    ElMessage.warning("请选择图片文件");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning("图片大小不能超过 5MB");
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();

    const res = await fetch("/api/upload/image", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err?.error?.message || "上传失败");
    }

    const { data } = await res.json();
    emit("update:modelValue", data.url);
    ElMessage.success("上传成功");
  } catch (err) {
    ElMessage.error(err.message || "上传失败");
  } finally {
    uploading.value = false;
    if (inputRef.value) inputRef.value.value = "";
  }
}

function triggerUpload() {
  inputRef.value?.click();
}

function clearImage() {
  emit("update:modelValue", "");
}
</script>

<template>
  <div class="image-upload">
    <div class="image-upload__label">{{ label }}</div>
    <div class="image-upload__body">
      <div v-if="modelValue" class="image-upload__preview">
        <img :src="modelValue" class="preview-img" referrerpolicy="no-referrer" alt="预览" />
        <div class="preview-actions">
          <button class="upload-btn" :disabled="uploading" @click="triggerUpload">
            {{ uploading ? "上传中..." : "重新上传" }}
          </button>
          <button class="clear-btn" @click="clearImage">移除</button>
        </div>
      </div>
      <div v-else class="image-upload__empty" :class="{ loading: uploading }">
        <div v-if="uploading" class="uploading-indicator">
          <span class="spinner"></span>
          <text>上传中...</text>
        </div>
        <template v-else>
          <div class="upload-icon" @click="triggerUpload">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <text class="upload-hint">点击上传图片</text>
        </template>
      </div>
    </div>
    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.image-upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-upload__label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.image-upload__body {
  width: 160px;
}

.image-upload__preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--el-border-color-light);
  display: block;
}

.preview-actions {
  display: flex;
  gap: 6px;
}

.upload-btn,
.clear-btn {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.clear-btn:hover {
  border-color: var(--el-color-danger);
  color: var(--el-color-danger);
}

.upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-upload__empty {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 2px dashed var(--el-border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
  background: var(--el-fill-color-light);
}

.image-upload__empty:hover {
  border-color: var(--el-color-primary);
}

.image-upload__empty.loading {
  cursor: default;
  pointer-events: none;
}

.uploading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--el-border-color);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.upload-icon {
  width: 40px;
  height: 40px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-icon svg {
  width: 32px;
  height: 32px;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
