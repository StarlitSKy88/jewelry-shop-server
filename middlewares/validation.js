const Joi = require('joi');

// 注册验证
const validateRegistration = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.min': '用户名至少需要3个字符',
        'string.max': '用户名不能超过30个字符',
        'any.required': '用户名是必填项'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': '请输入有效的邮箱地址',
        'any.required': '邮箱是必填项'
      }),
    password: Joi.string()
      .min(6)
      .max(30)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.min': '密码至少需要6个字符',
        'string.max': '密码不能超过30个字符',
        'string.pattern.base': '密码必须包含至少一个大写字母、一个小写字母和一个数字',
        'any.required': '密码是必填项'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': '两次输入的密码不一致',
        'any.required': '请确认密码'
      })
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path[0],
      message: detail.message
    }));
    return res.status(400).json({ errors });
  }

  next();
};

// 登录验证
const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': '请输入有效的邮箱地址',
        'any.required': '邮箱是必填项'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': '密码是必填项'
      })
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path[0],
      message: detail.message
    }));
    return res.status(400).json({ errors });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin
}; 