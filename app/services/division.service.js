const DivisionRepository = require("../repositories/division.repository");

class DivisionService {
    /*
   A class to represent a division service.

   Attributes:
       -

   Methods:
       getDivision(): get all division from database
      
 */
  async getDivision() {
    /*
        get all division from database

        Args:
            -

        Raises:
            ValueError: -
    
        Example:
            >>> division = DivisionService()
            >>> division.getDivision()
    */
    return await DivisionRepository.getDivision();
  }
}

module.exports = new DivisionService();
