const AuthenticationService = require("../services/authentication.service");
const AuthenticationValidator = require("../validators/authentication.validator");
const AuthenticationDataCleaner = require("../middlewares/dataCleaner").Authentication;

class AuthenticationController {
  //sign up
  async signUp(req, res) {
    try {
      //validate signup input
      await AuthenticationValidator.validateSignUp(req.body);
      //check emp no is used or not?
      await AuthenticationService.checkDuplicateEmpNo(req.body.emp_no);
      //check email is used or not?
      await AuthenticationService.checkDuplicateEmail(req.body.email);
      //post sign up
      return res.status(201).json({
        result: await AuthenticationService.signUp(
          await AuthenticationDataCleaner.prepareSignup(req.body)
        ),
      });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }

  // assign role
  async assignRole(req, res) {
    try {
      //validate signup input
      await AuthenticationValidator.validateAssignRole(req.body);
      //update role
      return res
        .status(200)
        .json({ result: await AuthenticationService.assignRole(req.body) });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }

  // accept signup
  async acceptSignup(req, res) {
    try {
      //validate accept signup
      await AuthenticationValidator.validateAcceptSignup(req.body);
      //accept signup
      return res
        .status(200)
        .json({ result: await AuthenticationService.acceptSignup(req.body) });
    } catch (error) {
      
      return res.status(500).json({ result: error });
    }
  }

  // log in
  async logIn(req, res) {
    try {
      //validate login
      await AuthenticationValidator.validateLogIn(req.body);
      //check emp no matching
      await AuthenticationService.checkMatchUser(req.body.emp_no);
      // check matching password
      await AuthenticationService.checkMatchPassword(
        req.body.emp_no,
        req.body.password
      );
      //get authenication detail from input
      let getAuthenDetail = await AuthenticationService.getAuthenDetail(req.body.emp_no)
      //check if authentication doesn't exists
      await AuthenticationValidator.checkAuthenIsEmpty(getAuthenDetail)
      //accept log in
      return res.status(200).json({
        result: "Login successful",
        token: await AuthenticationService.logIn(
          await AuthenticationDataCleaner.prepareLogin(req.body)
        ),
        empNo: getAuthenDetail.empNo
      });
    } catch (error) {
      
      return res.status(500).json({ result: error });
    }
  }

  // change password
  async changePassword(req, res) {
    try {
      //validate change password
      await AuthenticationValidator.validateChangePassword(req.body);
      //check user
      await AuthenticationService.checkMatchUser(req.body.emp_no);
      // // check matching password
      await AuthenticationService.checkMatchPassword(
        req.body.emp_no,
        req.body.password
      );
      // //accept log in
      return res.status(200).json({
        result: await AuthenticationService.changePassword(
          await AuthenticationDataCleaner.prepareChangePassword(req.body)
        ),
      });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }

  // delete account
  async deleteAccount(req, res) {
    try {
      //validate delete account
      await AuthenticationValidator.validateDeleteAccount(req.body);
      //delete account
      return res.status(200).json({
        result: await AuthenticationService.deleteAccount(req.body.auth_id),
      });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }

  // get account
  async getAllAccount(req, res) {
    try {
      //get account
      return res.status(200).json({
        result: await AuthenticationService.getAllAccount(),
      });
    } catch (error) {
      
      return res.status(500).json({ result: error });
    }
  }
  // get role
  async getRole(req, res) {
    try {
      // get role
      return res.status(200).json({
        result: await AuthenticationService.getRole()
      })
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }
  // get level
  async getLevel(req, res) {
    try {
      // get level
      return res.status(200).json({
        result: await AuthenticationService.getLevel()
      })
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }
  //get all admin
  async getAllEmailAdmin(req, res) {
    try {
      // get all role admin only
      return res.status(200).json({
        result: await AuthenticationService.getAllEmailAdmin()
      })
    } catch (error) {
      return res.status(500).json({ result: error });
    }
  }
}

module.exports = new AuthenticationController();
