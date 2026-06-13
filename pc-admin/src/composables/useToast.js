import { reactive } from "vue";

export function useToast() {
  const toast = reactive({ visible: false, message: "" });
  let timer;

  function showToast(message) {
    toast.message = message;
    toast.visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      toast.visible = false;
    }, 2200);
  }

  return { toast, showToast };
}
