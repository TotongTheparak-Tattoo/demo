const LocationService = require("../services/location.service");

class LocationController {
    async getAllLocation(req, res) {
        try {
            return res.status(200).json({
                result: await LocationService.getAllLocation()
            })
        } catch (error) {
            return res.status(500).json({ result: error });
        }
    }
 
    async getLocationForManualLocation(req, res) {
        try {
            let division_id = req.query.division_id;
            await receiveValidator.checkValidInputDivsion(division_id);
            let getLocationForManual = await (LocationService.getLocationForManualLocation(division_id));
            return res.status(200).json({
                result: getLocationForManual,
            })
        } catch (error) {
            return res.status(500).json({ result: error });
        }
    }
    async getAvailableLocation(req, res) {
        try {
            let selectUnit = req.query.selectUnit;

            let getAvailableLocation = await LocationService.getAvailableLocations(selectUnit)
            return res.status(200).json({
                result: getAvailableLocation,
            })
        } catch (error) {
            return res.status(500).json({ result: error });
        }
    }
    async insertBulkLocation(req, res) {
        try {
            let data = req.body

            let callResult = await LocationService.InsertBulkLocation(data)
            return res.status(200).json({
                result: callResult
            })
        } catch (error) {
            return res.status(500).json({ result: error });
        }

    }
    async findAllLocation(req, res) {
        try {
            let findAllLoc = await LocationService.findAllLocationTest();
            return res.status(200).json({
                result: findAllLoc,
            });
        } catch (error) {
            return res.status(500).json({ result: error });
        }
    }


}
module.exports = new LocationController();
