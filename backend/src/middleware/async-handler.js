export function asyncHandler(handler) {
  return async (c, next) => {
    try {
      return await handler(c, next);
    } catch (err) {
      throw err;
    }
  };
}
