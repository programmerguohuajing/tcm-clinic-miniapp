<script setup>
import ImageUpload from "./ImageUpload.vue";

const props = defineProps({
  editor: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(["close", "save"]);

function updateCheckboxArray(field, value, checked) {
  const list = Array.isArray(props.editor.model[field.name]) ? props.editor.model[field.name] : [];
  props.editor.model[field.name] = checked ? [...new Set([...list, value])] : list.filter((item) => item !== value);
}

function getRules(field) {
  const rules = [];
  if (field.required) rules.push({ required: true, message: `请填写${field.label}`, trigger: "blur" });
  if (field.type === "number" && field.min !== undefined) rules.push({ type: "number", min: field.min, message: `${field.label}不能小于${field.min}`, trigger: "blur" });
  if (field.type === "number" && field.max !== undefined) rules.push({ type: "number", max: field.max, message: `${field.label}不能大于${field.max}`, trigger: "blur" });
  return rules.length ? rules : undefined;
}
</script>

<template>
  <el-dialog
    :model-value="editor.visible"
    :title="editor.title"
    width="820px"
    class="tcm-dialog"
    append-to-body
    align-center
    @close="$emit('close')"
  >
    <el-form label-position="top" class="form-grid">
      <el-form-item
        v-for="field in editor.fields"
        :key="field.name"
        :label="field.label"
        :class="{ wide: field.wide }"
        :rules="getRules(field)"
        :prop="field.name"
      >
        <el-input
          v-if="field.type === 'textarea'"
          v-model="editor.model[field.name]"
          type="textarea"
          :rows="4"
        />
        <el-select
          v-else-if="field.type === 'select'"
          v-model="editor.model[field.name]"
          filterable
          clearable
          teleported
          popper-class="dialog-popper"
        >
          <el-option
            v-for="option in field.options"
            :key="String(option.value)"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-checkbox-group
          v-else-if="field.type === 'checks'"
          :model-value="editor.model[field.name] || []"
          @change="editor.model[field.name] = $event"
        >
          <el-checkbox
            v-for="option in field.options"
            :key="option.value"
            :label="option.value"
          >
            {{ option.label }}
          </el-checkbox>
        </el-checkbox-group>
        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="editor.model[field.name]"
          :min="field.min ?? 0"
          :max="field.max"
          controls-position="right"
        />
        <el-time-picker
          v-else-if="field.type === 'time'"
          v-model="editor.model[field.name]"
          value-format="HH:mm"
          format="HH:mm"
          placeholder="选择时间"
          teleported
        />
        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="editor.model[field.name]"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          teleported
        />
        <ImageUpload
          v-else-if="field.type === 'upload'"
          :model-value="editor.model[field.name]"
          :label="field.label"
          @update:model-value="editor.model[field.name] = $event"
        />
        <el-input
          v-else
          v-model="editor.model[field.name]"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" @click="$emit('save')">保存</el-button>
    </template>
  </el-dialog>
</template>
