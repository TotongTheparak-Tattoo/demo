const db = require("../models");
const Authentication = db.authenication;
const Role = db.role;
const Division = db.division;
const Level = db.level;

const BaseRepository = require("./base.repository");

class AuthenticationRepository extends BaseRepository {
  constructor() {
    super(Authentication); // Pass the model to the base class
  }

  //get id by emp no
  async getIDByEmpNo(empNo) {
    return await Authentication.findOne({
      attributes: ["authId"],
      where: { empNo: empNo },
      raw: true,
    });
  }

  //get signup status by emp no
  async getSignupStatusByEmpNo(empNo) {
    return await Authentication.findOne({
      attributes: ["signupStatus"],
      where: { empNo: empNo },
      raw: true,
    });
  }

  //get divisionId by emp no
  async getDivisionIdByEmpNo(empNo) {
    return await Authentication.findOne({
      attributes: ["divisionId"],
      where: { empNo: empNo },
      raw: true,
    });
  }

  //get Email by email
  async getEmail(email) {
    return await Authentication.findOne({
      attributes: ["email"],
      where: { email: email },
      raw: true,
    });
  }
  //get all Email admin only
  async getAllEmailAdmin() {
    return await Authentication.findAll({
      attributes: ["email", "signupStatus", "roleId"],
      where: {
        roleId: 1,
        signupStatus: 'activate'
      },
      raw: true,
    });
  }

  //get password by emp no
  async getPasswordByEmpNo(empNo) {
    return await Authentication.findOne({
      attributes: ["password"],
      where: { empNo: empNo },
      raw: true,
    });
  }
  //get roleName by emp no
  async getRoleByEmpNo(empNo) {
    return await Authentication.findOne({
      attributes: ["Role.roleName"],
      where: { empNo: empNo },
      raw: true,
      include: {
        model: Role,
        attributes: ["roleName"],
      },
    });
  }
  async getLevelByEmpNo(empNo) {
    return await Authentication.findOne({
      attributes: ["Level.levelName"],
      where: { empNo: empNo },
      raw: true,
      include: {
        model: Level,
        attributes: ["levelName"],
      },
    });
  }


  //delete with auth id
  async delete(id) {
    return await this.model.destroy({
      where: {
        authId: id,
      },
    });
  }

  async getAll() {
    return await this.model.findAll({
      raw: true
    });
  }
  async getRole() {
    return await Role.findAll({ raw: true })
  }
  async getLevel() {
    return await Level.findAll({ raw: true })
  }
  async getAuthentication(empNo) {
    return await Authentication.findOne({
      where: { empNo: empNo },
      raw: true
    })
  }
}

module.exports = new AuthenticationRepository();
