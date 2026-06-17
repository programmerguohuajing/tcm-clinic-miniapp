export function notFound(_req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "接口不存在" } });
}

function formatZodIssues(issues) {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (err.name === "ZodError") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "参数校验失败",
        details: formatZodIssues(err.issues)
      }
    });
  }

  const status = err.statusCode || err.status || 500;

  if (status >= 500 && isProductionEnv()) {
    return res.status(status).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误"
      }
    });
  }

  res.status(status).json({
    error: {
      code: err.code || "ERROR",
      message: err.message || "服务器内部错误"
    }
  });
}

function isProductionEnv() {
  return process.env.NODE_ENV === "production";
}
