import { reactive } from "vue";

export function useCrudEditor({ onSaved, showToast }) {
  const editor = reactive({
    visible: false,
    title: "",
    fields: [],
    model: {},
    submit: null
  });

  function openEditor({ title, fields, model = {}, submit }) {
    editor.title = title;
    editor.fields = fields;
    editor.model = structuredClone(model);
    editor.submit = submit;
    editor.visible = true;
  }

  async function saveEditor() {
    try {
      await editor.submit(editor.model);
      editor.visible = false;
      showToast?.("保存成功");
      await onSaved?.();
    } catch (error) {
      showToast?.(error.message);
    }
  }

  return { editor, openEditor, saveEditor };
}
