const AuthenticationRepository = require("../repositories/authentication.repository");
const DivisionRepository = require("../repositories/division.repository");

const JTW = require("../middlewares/jwt");
const bcrypt = require("bcrypt");

class AuthenticationService {
  /*
    A class to represent a authenication permission.

    Attributes:
        -

    Methods:
        signup(data):
            sign up with empNo, email, password, role_id, division_id.
        
        checkDuplicateEmpNo(empNo):
            check duplicate emp no is already used or not ?
        
        checkDuplicateEmail(empNo):
            check duplicate email is already used or not ?
        
        assignRole(data):
            assign role of emp no.

        acceptSignup(data):
           accept user that signup.

        checkMatchUser(empNo):
            check matching emp no.

        checkMatchPassword(empNo, password):
            check matching password.

        logIn(data):
            login and create token.

        changePassword(data):
            change new password with emp no and old password.
          
        deleteAccount(auth_id):
            delete account with auth id.

        getAllAccount(auth_id):
            get all account.        
  */
  async signUp(data) {
    /*
        sign up with empNo, email, password, role_id, division_id

        Args:
            empNo (string): The employee number.
            email (string): The email.
            password (string): The password.
            roleId (int): The role id.
            levelId (int): The level id.
            divisionId (int): The division id.

        Raises:
            ValueError: If the roleId or divisionId or levelId not found.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.signUp("J6639", "suraphop.b@minebea.co.th", "password", 1, 1)
            sign up success: J6639
            */
    try {
      await AuthenticationRepository.add(data);
      return `sign up success: ${data.empNo}`;
    } catch (error) {
      if (error.name.includes("SequelizeForeignKeyConstraintError")) {
        throw "sign up error: role_id or division_id not found";
      }
      throw `sign up error: ${error}`;
    }
  }
  async checkDuplicateEmpNo(empNo) {
    /*
        check duplicate emp no is already used or not ?

        Args:
            empNo (string): The employee number.

        Raises:
            ValueError: If the empNo is already exists.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.checkDuplicateEmpNo("J6639")
            null
    */
    const get_emp_no = await AuthenticationRepository.getIDByEmpNo(
      empNo.toLowerCase()
    );
    if (get_emp_no) {
      throw `Duplicate emp no Error: ${empNo} is already exists`;
    }
  }
  async checkDuplicateEmail(email) {
    /*
        check duplicate email is already used or not ?

        Args:
            email (string): The email.

        Raises:
            ValueError: If the email is already exists.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.checkDuplicateEmail("suraphop.b@minebea.co.th")
            null
    */
    const get_email = await AuthenticationRepository.getEmail(email);
    if (get_email) {
      throw `Duplicate email Error: ${email} is already exists`;
    }
  }
  async assignRole(data) {
    /*
        assign role of emp no

        Args:
            auth_id (int): The authentication id.
            role_id (int): The role id.

        Raises:
            ValueError: If the role_id not found.
            ValueError: If the auth_id not found.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.assignRole(1,1)
            assign role success
    */
    const updates = { roleId: data.roleId };
    try {
      await AuthenticationRepository.update(data.authId, updates);
      return `assign role success`;
    } catch (error) {
      if (error.name.includes("SequelizeForeignKeyConstraintError")) {
        throw "assign role error: roleId not found";
      }
      if (error.name.includes("TypeError")) {
        throw "assign role error: authId not found";
      }
      throw `assign role error: ${error}`;
    }
  }
  async acceptSignup(data) {
    /*
        accept user that signup

        Args:
            auth_id (int): The authentication id.

        Raises:
            ValueError: If the auth_id not found.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.acceptSignup(1)
            accept sign up success
    */
    const updates = { signupStatus: "activate" };
    try {
      await AuthenticationRepository.update(data.authId, updates);
      return `accept sign up success`;
    } catch (error) {
      throw `accept sign up error: ${error}`;
    }
  }
  async checkMatchUser(empNo) {
    /*
        check matching emp no

        Args:
            empNo (string): The employee number.

        Raises:
            ValueError: If the empNo is not found.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.checkMatchUser("J6639")
            null
    */
    const password = await AuthenticationRepository.getIDByEmpNo(empNo);
    if (!password) {
      throw `login error: ${empNo} is not found`;
    }
  }
  async checkMatchPassword(empNo, password) {
    /*
        check matching password

        Args:
            empNo (string): The employee number.
            password (string): The password.

        Raises:
            ValueError: If the password is wrong.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.checkMatchPassword("J6639", "password")
            null
    */
    const hash_password = await AuthenticationRepository.getPasswordByEmpNo(
      empNo
    );
    // Check if the password is correct
    const passwordIsMatch = await bcrypt.compare(
      password,
      hash_password.password
    );
    if (!passwordIsMatch) {
      throw `login error: password is wrong with ${empNo}`;
    }
  }
  async logIn(data) {
    /*
        login and create token

        Args:
            empNo (string): The employee number.
            password (string): The password.

        Raises:
            ValueError: If the empNo is not found.
            ValueError: If the password is wrong.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.logIn("J6639", "password")
            token
    */
    try {
      const role = await AuthenticationRepository.getRoleByEmpNo(data.emp_no);
      const level = await AuthenticationRepository.getLevelByEmpNo(data.emp_no);
      const authId = await AuthenticationRepository.getIDByEmpNo(data.emp_no);
      const signupStatus = await AuthenticationRepository.getSignupStatusByEmpNo(data.emp_no);
      const divisionId = await AuthenticationRepository.getDivisionIdByEmpNo(data.emp_no);
      return await JTW.createToken(data.emp_no, role.roleName, level.levelName, signupStatus.signupStatus, divisionId.divisionId, authId.authId);
    } catch (error) {
      throw `login error: ${error}`;
    }
  }
  async changePassword(data) {
    /*
        change new password with emp no and old password

        Args:
            empNo (string): The employee number.
            old_password (string): The old password.
            new_password (string): The new password.

        Raises:
            ValueError: If the empNo is not found.
            ValueError: If the old password is wrong.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.changePassword("J6639", "password", "new_password")
            change password successful
    */
    const updates = { password: data.new_password };
    try {
      const authId = await AuthenticationRepository.getIDByEmpNo(data.empNo);
      await AuthenticationRepository.update(authId.authId, updates);
      return `change password successful`;
    } catch (error) {
      throw `change password error: ${error}`;
    }
  }
  async deleteAccount(authId) {
    /*
        delete account with auth id

        Args:
            auth_id (int): The authentication id.

        Raises:
            ValueError: If the auth_id is not found.
        
        Example:
            >>> authen = AuthenticationService()
            >>> authen.deleteAccount(1)
            delete account successful
    */
    try {
      await AuthenticationRepository.delete(authId);
      return `delete account successful`;
    } catch (error) {
      throw `delete account error: ${error}`;
    }
  }
  async getAllAccount() {
    try {
      //get all account
      const accounts = await AuthenticationRepository.getAll();
      //get all role level divition
      const [roles, levels, divisions] = await Promise.all([
        AuthenticationRepository.getRole(),
        AuthenticationRepository.getLevel(),
        DivisionRepository.getDivision()
      ]);
      //map authId to rolename levelname divitionname
      const roleMap = new Map(roles.map(r => [Number(r.roleId), r.roleName]));
      const levelMap = new Map(levels.map(l => [Number(l.levelId), l.levelName]));
      const divisionMap = new Map(divisions.map(d => [Number(d.divisionId), d.divisionName]));
      //format data
      const result = accounts.map(a => ({
        ...a,
        roleName: roleMap.get(Number(a.roleId)) ?? null,
        levelName: levelMap.get(Number(a.levelId)) ?? null,
        divisionName: divisionMap.get(Number(a.divisionId)) ?? null,
      }));

      return result;
    } catch (error) {
      throw new Error(`get all account error: ${error?.message || String(error)}`);
    }
  }
  async getRole() {
    try {
      return await AuthenticationRepository.getRole()
    } catch (error) {
      throw `get role error: ${error}`;
    }
  }
  async getLevel() {
    try {
      return await AuthenticationRepository.getLevel()
    } catch (error) {
      throw `get level error: ${error}`;
    }
  }
  async getAuthenDetail(empNo) {
    try {
      return await AuthenticationRepository.getAuthentication(empNo)
    } catch (error) {
      throw `get authen error: ${error}`;
    }
  }
  async getAllEmailAdmin() {
    try {
      return await AuthenticationRepository.getAllEmailAdmin()
    } catch (error) {
      throw `get authen error: ${error}`;
    }
  }
}

module.exports = new AuthenticationService();
