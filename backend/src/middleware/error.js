export function notFound(_req, res) {
  res.status(404).json({ message: "接口不存在" });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "参数校验失败",
      issues: err.issues
    });
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    message: err.message || "服务器内部错误"
  });
}

