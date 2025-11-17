const db = require("../models");
const Division = db.division;

const BaseRepository = require("./base.repository");

class DivisionRepository extends BaseRepository {
  constructor() {
    super(Division); // Pass the model to the base class
  }

  //get Division
  async getDivision() {
    return await Division.findAll({
      attributes: ['divisionId', 'divisionName',], raw: true
    }); 
  }
}
module.exports = new DivisionRepository();
