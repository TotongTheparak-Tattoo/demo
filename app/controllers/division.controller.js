const DivisionService = require("../services/division.service");

class DivisionController {
  //get all division
  async getDivision(req, res) {
    try {
      let getDivision = await DivisionService.getDivision();
      return res.status(200).json({
        result: getDivision,
      });
    } catch (error) {
      return res.status(500).json({ result: error });
    }
}
}
module.exports = new DivisionController();
