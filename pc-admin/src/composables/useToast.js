import { reactive } from "vue";

export function useToast() {
  const toast = reactive({ visible: false, message: "", type: "success" });
  let timer;

  function showToast(message, type = "success") {
    toast.message = message;
    toast.type = type;
    toast.visible = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      toast.visible = false;
    }, 2200);
  }

  return { toast, showToast };
}
