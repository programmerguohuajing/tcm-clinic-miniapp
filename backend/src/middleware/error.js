export function notFoundMiddleware(c) {
  return c.json({ error: { code: "NOT_FOUND", message: "接口不存在" } }, 404);
}

export function errorMiddleware(err, c) {
  console.error("[error]", err.name, err.message, err.stack);

  // If a middleware already returned a Response (e.g. auth 401), pass it through
  if (err instanceof Response) return err;

  if (err.name === "ZodError" || err.issues) {
    const issues = err.issues || err;
    const details = issues.map((issue) => ({
      path: issue.path?.join(".") || issue.path,
      message: issue.message
    }));
    return c.json({
      error: {
        code: "VALIDATION_ERROR",
        message: "参数校验失败",
        details
      }
    }, 400);
  }

  const status = err.statusCode || err.status || 500;

  if (status >= 500) {
    return c.json({
      error: {
        code: "INTERNAL_ERROR",
        message: err.message || "服务器内部错误",
        detail: process.env.NODE_ENV === "development" ? err.stack : undefined
      }
    }, 500);
  }

  return c.json({
    error: {
      code: err.code || "ERROR",
      message: err.message || "服务器内部错误"
    }
  }, status);
}
