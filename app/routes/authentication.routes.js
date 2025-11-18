const AutheniticationController = require("../controllers/authentication.controller");

module.exports = function (app) {
  app.post("/api/v1/authen/signup", AutheniticationController.signUp);
  app.post("/api/v1/authen/login", AutheniticationController.logIn);
  app.put(
    "/api/v1/authen/assign_role",
    AutheniticationController.assignRole
  );
  app.put(
    "/api/v1/authen/accept_signup",
    AutheniticationController.acceptSignup
  );
  app.put(
    "/api/v1/authen/change_password",
    AutheniticationController.changePassword
  );
  app.delete(
    "/api/v1/authen/delete_account",
    AutheniticationController.deleteAccount
  );
  app.get(
    "/api/v1/authen/get_all_account",
    AutheniticationController.getAllAccount
  );
  app.get(
    "/api/v1/authen/get_role",
    AutheniticationController.getRole
  );
  app.get(
    "/api/v1/authen/get_level",
    AutheniticationController.getLevel
  );
  app.get(
    "/api/v1/authen/get_all_email_admin",
    AutheniticationController.getAllEmailAdmin
  );
};
