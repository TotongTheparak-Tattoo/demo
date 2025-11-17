const Joi = require("joi");

const authenticationSchema = {
  // Schema for signup
  signUp: Joi.object({
    emp_no: Joi.string().min(5).max(5).required(),
    email: Joi.string()
      .pattern(/^([a-zA-Z0-9._%+-]+)@minebea.co.th/)
      .required()
      .messages({
        "string.pattern.base": "must be use minebea email",
      }),
    password: Joi.string().min(8).required(),
    repassword: Joi.string().valid(Joi.ref("password")).required().messages({
      "any.only": "Password and Repassword must match",
    }),
    divisionId: Joi.number().min(0).required(),
    role_id: Joi.number().min(0).required(),
    level_id: Joi.number().min(0).required(),
  }),
  // Schema for sign in
  signIn: Joi.object({
    emp_no: Joi.string().min(5).max(5).required(),
    password: Joi.string().min(8).required(),
  }),
  // Schema for sign in
  assignRole: Joi.object({
    auth_id: Joi.number().min(0).required(),
    role_id: Joi.number().min(0).required(),
  }),
  // Schema for accept signup
  acceptSignup: Joi.object({
    authId: Joi.number().min(0).required(),
  }),
  // Schema for  log in
  logIn: Joi.object({
    emp_no: Joi.string().min(5).max(5).required(),
    password: Joi.string().min(8).required(),
  }),
  // Schema for change password
  changePassword: Joi.object({
    emp_no: Joi.string().min(5).max(5).required(),
    password: Joi.string().min(8).required(),
    new_password: Joi.string().min(8).required(),
    re_new_password: Joi.string()
      .valid(Joi.ref("new_password"))
      .required()
      .messages({
        "any.only": "New Password and Re New password must match",
      }),
  }),
  // Schema for delete account
  deleteAccount: Joi.object({
    auth_id: Joi.number().min(0).required(),
  }),
};

module.exports = authenticationSchema;
