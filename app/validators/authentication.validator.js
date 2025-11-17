const authenticationSchema = require("../schemas/authenication.schema");

class AuthenticationValidator {
  // Validate using the schema for sign up
  async validateSignUp(data) {
    const { error } = authenticationSchema.signUp.validate(data);
    if (error) {
      //throw new Error(`Validation Error: ${error.details[0].message}`);
      throw `Validation Error: ${error.details[0].message}`;
    }
  }

  // Validate using the schema for assign role
  async validateAssignRole(data) {
    const { error } = authenticationSchema.assignRole.validate(data);
    if (error) {
      //throw new Error(`Validation Error: ${error.details[0].message}`);
      throw `Validation Error: ${error.details[0].message}`;
    }
  }

  // Validate using the schema for log in
  async validateLogIn(data) {
    const { error } = authenticationSchema.logIn.validate(data);
    if (error) {
      //throw new Error(`Validation Error: ${error.details[0].message}`);
      throw `Validation Error: ${error.details[0].message}`;
    }
  }

  // Validate using the schema for change password
  async validateChangePassword(data) {
    const { error } = authenticationSchema.changePassword.validate(data);
    if (error) {
      //throw new Error(`Validation Error: ${error.details[0].message}`);
      throw `Validation Error: ${error.details[0].message}`;
    }
  }

  // Validate using the schema for delete account
  async validateDeleteAccount(data) {
    const { error } = authenticationSchema.deleteAccount.validate(data);
    if (error) {
      //throw new Error(`Validation Error: ${error.details[0].message}`);
      throw `Validation Error: ${error.details[0].message}`;
    }
  }
  async checkAuthenIsEmpty(data) {
    if (data == null)
      throw "No data existed in Authentication."
  }
  async validateAcceptSignup(data){
    const { error } = authenticationSchema.acceptSignup.validate(data);
    if (error) {
      throw `Validation Error: ${error.details[0].message}`;
    }
  }
}

module.exports = new AuthenticationValidator();
