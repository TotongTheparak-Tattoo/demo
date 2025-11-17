const LocationRepository = require("../repositories/location.repository");
const productBalanceRepository = require("../repositories/productBalance.repository");
class LocationService {
  /*
 A class to represent a location service.

 Attributes:
     -

 Methods:
     InsertBulkLocation(data): insert inputted data to location
     getLocationByDivisionId(divisionId): get location by division Id 
     getLocationForManualLocation(divisionId): get location form user input by division Id 
     getLocationForOccupiedLocation(divisionId): get used location
     getAllLocationUnrequiredDiv(): get all location even with divisionId is null
     GetPutawayLocation(): get put away location
     GetAvailableLocationById(divisionId): get available location that isn't used from inputted divisionId
     getAllLocation(): get all location
     getUsedLocation(): get used location
*/



  async getLocationByDivisionId(divisionId) {
      /*
        get location by division Id 
 
        Args:
            divisionId (Int): 
 
        Raises:
            ValueError: -
    
        Example:
            >>> location = LocationService()
            >>> location.getLocationByDivisionId(1)
    */
    try {
      return await LocationRepository.GetAllLocationByDivisionId(divisionId);
    } catch (error) {
      throw `${error}`;
    }
  }
  async getLocationForManualLocation(divisionId) {
      /*
        get available location that isn't used from inputted divisionId
 
        Args:
            divisionId (Int): 
 
        Raises:
            ValueError: -
    
        Example:
            >>> location = LocationService()
            >>> location.getLocationForManualLocation(8)
    */
    try {
      return await LocationRepository.getLocationForManualLocation(divisionId);
    } catch (error) {
      throw `${error}`;
    }
  }
  async getAvailableLocations(selectUnit) {
    try {
      let getReceiveLocation = await LocationRepository.GetReceiveLocation(selectUnit);
      let getAllLocation = await LocationRepository.GetAllLocationFromUnit(selectUnit);
      let emptyLocation = [];
      getAllLocation.forEach((locationItem) => {
        let exist = false;
        getReceiveLocation.forEach((receiveItem) => {
          if (locationItem.locationId == receiveItem.locationId) {
            exist = true;
            return;
          }
        });
        if (!exist) emptyLocation.push(locationItem);
      });
      return emptyLocation;
    } catch (error) {
      throw error;
    }
  }
  async getLocationById(locationId) {
    try {
     
      return await LocationRepository.findLocationById(locationId)
    } catch (error) {
      throw error;
    }
  }
  async getAllLocation() {
    /*
        get all location
 
        Args:
            -
 
        Raises:
            ValueError: -
    
        Example:
            >>> location = LocationService()
            >>> location.getAllLocation()
    */
    try {
      return await LocationRepository.findAll()
    } catch (error) {
      throw `${error}`;
    }
  }
  async InsertBulkLocation(data) {
    try {
      await LocationRepository.InsertBulkLocation(data);
      return 'ok'
    } catch (error) {
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  }
  async findAllLocationTest() {
    try {
      return await LocationRepository.findAllLoc()
    } catch (error) {
      throw error;
    }
  }

}

module.exports = new LocationService();
