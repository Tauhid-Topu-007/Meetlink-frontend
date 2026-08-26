const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    req.body = parsed.body ?? req.body;
    req.query = parsed.query ?? req.query;
    req.params = parsed.params ?? req.params;
    next();
  } catch (err) {
    if (err.errors) {
      const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ success: false, message: messages.join('; ') });
    }
    return res.status(400).json({ success: false, message: 'Validation failed' });
  }
};

module.exports = validate;